import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import {
  getSessionUser,
  canAccessCustomer,
  isValidConsultationStatus,
  isValidDate,
  sanitizeString,
  parseId,
} from '@/lib/security'
import { logActivity } from '@/lib/activity-log'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) return apiError('Unauthorized', 401)
  if (user.role === 'demo_viewer') return apiError('demo mode: read-only', 405)

  const customerId = parseId(params.id)
  if (!customerId) {
    return apiError('유효한 고객 ID가 필요합니다.', 400)
  }

  // 권한 검증: 해당 고객의 clinic_id에 접근 가능한지 확인
  const accessCheck = await canAccessCustomer(customerId, user)
  if (!accessCheck.allowed) {
    return apiError(accessCheck.error || '권한이 없습니다.', 403)
  }

  const { status, notes, consultationDate } = await req.json()

  // 상태값 검증
  if (status !== undefined && status !== null && status !== '') {
    if (!isValidConsultationStatus(status)) {
      return apiError('유효하지 않은 상담 상태입니다.', 400)
    }
  }

  // 날짜 검증
  if (consultationDate !== undefined && consultationDate !== null && consultationDate !== '') {
    if (!isValidDate(consultationDate)) {
      return apiError('유효하지 않은 날짜 형식입니다.', 400)
    }
  }

  const supabase = serverSupabase()

  const { data: existing } = await supabase
    .from('consultations')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle()

  // notes 처리: undefined가 아니면 sanitize 적용
  const sanitizedNotes = notes !== undefined ? sanitizeString(notes, 1000) : undefined

  let result
  if (existing) {
    const updateData: Record<string, unknown> = { updated_by: Number(user.id) }
    if (status !== undefined) updateData.status = status
    if (sanitizedNotes !== undefined) updateData.notes = sanitizedNotes
    if (consultationDate !== undefined) updateData.consultation_date = consultationDate || null

    result = await supabase
      .from('consultations')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('consultations')
      .insert({
        customer_id: customerId,
        clinic_id: accessCheck.clinicId,
        status: status || null,
        notes: sanitizedNotes || null,
        consultation_date: consultationDate || null,
        created_by: Number(user.id),
      })
      .select()
      .single()
  }

  if (result.error) return apiError(result.error.message, 500)

  await logActivity(supabase, {
    userId: user.id, clinicId: accessCheck.clinicId,
    action: existing ? 'consultation_update' : 'consultation_create',
    targetTable: 'consultations', targetId: result.data.id,
    detail: { customer_id: customerId, status },
  })

  return apiSuccess(result.data)
}
