import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, withSuperAdmin, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId, sanitizeString } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { archiveBeforeDelete } from '@/lib/archive'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CustomersLeadDetail')

const VALID_STATUSES = ['new', 'in_progress', 'converted', 'hold', 'lost', 'invalid'] as const
const VALID_LOST_REASONS = ['no_response', 'not_interested', 'price_issue', 'chose_competitor', 'bad_timing', 'other'] as const

/**
 * 리드 상세 조회
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  let query = supabase
    .from('leads')
    .select(`
      *,
      contact:contacts(id, name, phone_number, first_source, total_conversions, total_conversion_value, created_at),
      landing_page:landing_pages(id, name)
    `)
    .eq('id', leadId)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data: lead, error } = await query.single()
  if (error || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  return apiSuccess(lead)
})

/**
 * 리드 상태 변경 API
 * - status: new, in_progress, converted, hold, lost, invalid
 * - conversion_value: 전환 시 금액 (필수)
 * - lost_reason: 미전환 시 사유
 * - conversion_memo: 메모
 */
export const PATCH = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const leadId = parseId(id)
  if (!leadId) return apiError('유효한 ID가 필요합니다.', 400)

  const body = await req.json()
  const { status, conversion_value, lost_reason, conversion_memo } = body

  if (!status) return apiError('상태를 지정해주세요.', 400)
  if (!VALID_STATUSES.includes(status)) {
    return apiError(`유효하지 않은 상태입니다. (${VALID_STATUSES.join(', ')})`, 400)
  }

  // 전환 시 금액 필수
  if (status === 'converted' && (conversion_value === undefined || conversion_value === null || conversion_value === '')) {
    return apiError('전환 금액을 입력해주세요.', 400)
  }

  // 미전환 시 사유 검증
  if (status === 'lost' && lost_reason && !VALID_LOST_REASONS.includes(lost_reason)) {
    return apiError('유효하지 않은 미전환 사유입니다.', 400)
  }

  // 리드 조회 (권한 확인)
  let query = supabase.from('leads').select('id, contact_id, client_id, lead_status').eq('id', leadId)
  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data: lead, error: fetchError } = await query.single()
  if (fetchError || !lead) return apiError('리드를 찾을 수 없습니다.', 404)

  // 업데이트 필드 구성
  const updateData: Record<string, unknown> = {
    lead_status: status,
    updated_by: Number(user.id),
  }
  if (status === 'converted') {
    updateData.conversion_value = Number(conversion_value)
  }
  if (status === 'lost' && lost_reason) {
    updateData.lost_reason = lost_reason
  }
  if (conversion_memo !== undefined) {
    updateData.conversion_memo = sanitizeString(conversion_memo, 500)
  }

  const { error: updateError } = await supabase.from('leads').update(updateData).eq('id', leadId)
  if (updateError) {
    logger.error('리드 상태 변경 실패', updateError, { clientId, leadId })
    return apiError(updateError.message, 500)
  }

  // 전환 시 contacts 테이블 누적 업데이트
  if (status === 'converted' && lead.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('total_conversions, total_conversion_value')
      .eq('id', lead.contact_id)
      .single()

    if (contact) {
      await supabase.from('contacts').update({
        total_conversions: (contact.total_conversions || 0) + 1,
        total_conversion_value: (contact.total_conversion_value || 0) + Number(conversion_value),
      }).eq('id', lead.contact_id)
    }
  }

  await logActivity(supabase, {
    userId: user.id,
    clientId: lead.client_id,
    action: 'lead_status_change',
    targetTable: 'leads',
    targetId: leadId,
    detail: { before: lead.lead_status, after: status, conversion_value, lost_reason, conversion_memo },
  })

  return apiSuccess({ success: true, lead_status: status })
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
    .select('id, client_id, contact_id')
    .eq('id', leadId)
    .single()
  if (!lead) return apiError('리드를 찾을 수 없습니다.', 404)

  await archiveBeforeDelete(supabase, 'leads', leadId, user.id, lead.client_id)
  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) return apiError(error.message, 500)

  await logActivity(supabase, {
    userId: user.id,
    clientId: lead.client_id,
    action: 'lead_delete',
    targetTable: 'leads',
    targetId: leadId,
    detail: { contact_id: lead.contact_id },
  })

  return apiSuccess({ deleted: true })
})
