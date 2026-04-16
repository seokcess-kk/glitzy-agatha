import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CustomersContacts')

/**
 * 연락처(고객DB) 목록 조회 API
 * - 검색: search (이름/전화번호)
 * - 페이지네이션: page, per_page
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  const search = url.searchParams.get('search')?.trim() || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)))

  let query = supabase
    .from('contacts')
    .select('id, name, phone_number, first_source, total_conversions, total_conversion_value, created_at, client_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiSuccess({ data: [], total: 0, page, per_page: perPage })
  query = filtered

  if (search) {
    // 이름 또는 전화번호에서 검색
    query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`)
  }

  const { data: contacts, error, count } = await query

  if (error) {
    logger.error('연락처 목록 조회 실패', error, { clientId })
    return apiError('데이터 조회에 실패했습니다.', 500)
  }

  // 각 연락처의 문의 횟수(리드 수) 조회
  const contactIds = (contacts || []).map(c => c.id)
  let leadCounts: Record<number, number> = {}

  if (contactIds.length > 0) {
    const { data: counts } = await supabase
      .from('leads')
      .select('contact_id')
      .in('contact_id', contactIds)

    if (counts) {
      counts.forEach((row: any) => {
        leadCounts[row.contact_id] = (leadCounts[row.contact_id] || 0) + 1
      })
    }
  }

  const enriched = (contacts || []).map(c => ({
    ...c,
    lead_count: leadCounts[c.id] || 0,
  }))

  return apiSuccess({ data: enriched, total: count || 0, page, per_page: perPage })
})
