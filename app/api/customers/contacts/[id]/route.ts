import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CustomersContactDetail')

/**
 * 연락처 상세 + 해당 연락처의 리드 목록 (타임라인)
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  const contactId = parseId(id)
  if (!contactId) return apiError('유효한 ID가 필요합니다.', 400)

  let query = supabase
    .from('contacts')
    .select(`
      id, name, phone_number, first_source, total_conversions, total_conversion_value, created_at, client_id,
      leads(id, utm_source, utm_campaign, utm_medium, utm_content, lead_status, conversion_value, conversion_memo, lost_reason, notes, created_at, landing_page:landing_pages(id, name))
    `)
    .eq('id', contactId)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data: contact, error } = await query.single()
  if (error || !contact) return apiError('연락처를 찾을 수 없습니다.', 404)

  // leads를 최신순 정렬
  const sortedLeads = [...(contact.leads || [])].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return apiSuccess({
    ...contact,
    leads: sortedLeads,
  })
})
