import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, withSuperAdmin, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId, sanitizeString } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete } from '@/lib/archive'

const VALID_LEAD_STATUSES = ['new', 'no_answer', 'consulted', 'booked', 'hold', 'rejected'] as const

/**
 * 리드 상태/메모 변경 API
 * - lead_status, notes 변경
 * - "booked" 상태로 변경 시 bookings 테이블에 자동 생성 (메모 포함)
 */
export const PATCH = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const body = await req.json()
  const { lead_status, notes } = body

  // 최소 하나는 있어야 함
  if (!lead_status && notes === undefined) {
    return apiError('변경할 항목이 없습니다.', 400)
  }

  if (lead_status && !VALID_LEAD_STATUSES.includes(lead_status)) {
    return apiError(`유효하지 않은 상태입니다. (${VALID_LEAD_STATUSES.join(', ')})`, 400)
  }

  // 리드 조회 (clinic_id 권한 확인 포함)
  let query = supabase.from('leads').select('id, customer_id, clinic_id, lead_status, notes').eq('id', leadId)
  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data: lead, error: fetchError } = await query.single()
  if (fetchError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  // 업데이트할 필드 구성
  const updateData: Record<string, unknown> = { updated_by: Number(user.id) }
  if (lead_status) updateData.lead_status = lead_status
  if (notes !== undefined) updateData.notes = sanitizeString(notes, 1000)

  const { error: updateError } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId)
  if (updateError) return apiError(updateError.message, 500)

  // "booked" 상태로 변경 시 bookings 자동 생성
  if (lead_status === 'booked' && lead.lead_status !== 'booked') {
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('customer_id', lead.customer_id)
      .eq('clinic_id', lead.clinic_id)
      .in('status', ['confirmed', 'visited', 'treatment_confirmed'])
      .limit(1)
      .maybeSingle()

    if (!existingBooking) {
      // 리드 메모를 예약 메모로 전달
      const bookingNotes = (notes !== undefined ? sanitizeString(notes, 1000) : lead.notes) || ''
      const { data: newBooking } = await supabase.from('bookings').insert({
        customer_id: lead.customer_id,
        clinic_id: lead.clinic_id,
        status: 'confirmed',
        booking_datetime: new Date().toISOString(),
        notes: bookingNotes,
        created_by: Number(user.id),
      }).select('id').single()

      if (newBooking) {
        await logActivity(supabase, {
          userId: user.id, clinicId: lead.clinic_id,
          action: 'booking_create', targetTable: 'bookings', targetId: newBooking.id,
          detail: { customer_id: lead.customer_id, source: 'lead_status_booked', lead_id: leadId },
        })
      }
    }
  }

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: lead_status ? 'lead_status_change' : 'lead_note_update',
    targetTable: 'leads', targetId: leadId,
    detail: { before: lead.lead_status, after: lead_status, notes_changed: notes !== undefined },
  })

  return apiSuccess({ success: true, lead_status, notes: updateData.notes })
})

/**
 * 리드 삭제 (superadmin 전용)
 */
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const { data: lead } = await supabase
    .from('leads')
    .select('id, clinic_id, customer_id')
    .eq('id', leadId)
    .single()
  if (!lead) return apiError('리드를 찾을 수 없습니다.', 404)

  await archiveBeforeDelete(supabase, 'leads', leadId, user.id, lead.clinic_id)
  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: lead.clinic_id,
    action: 'lead_delete', targetTable: 'leads', targetId: leadId,
    detail: { customer_id: lead.customer_id },
  })

  return apiSuccess({ deleted: true })
})
