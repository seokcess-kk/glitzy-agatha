import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { isDemoViewer, getDemoAdsPerformance } from '@/lib/demo-data'

const logger = createLogger('AdsStats')

// inflow_url에서 utm_id (Meta campaign_id) 추출
function extractUtmId(inflowUrl: string | null): string | null {
  if (!inflowUrl) return null
  const match = inflowUrl.match(/utm_id=(\d+)/)
  return match?.[1] || null
}

export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoAdsPerformance())

  const url = new URL(req.url)
  // startDate/endDate 우선 (KST 기준 [start, end] 범위). 없으면 days 폴백 ("오늘부터 N일 전").
  const startDateParam = url.searchParams.get('startDate')
  const endDateParam = url.searchParams.get('endDate')
  const daysParam = Number(url.searchParams.get('days') || 30)
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30
  const platform = url.searchParams.get('platform')

  const supabase = serverSupabase()

  // since/until 결정 — startDate/endDate 가 있으면 그 범위, 없으면 days 기반 fallback
  const since = startDateParam
    ? getKstDateString(new Date(startDateParam))
    : getKstDateString(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
  const until = endDateParam ? getKstDateString(new Date(endDateParam)) : null

  // leads (created_at timestamp) 범위 — KST 자정 [start, end)
  const tsSince = `${since}T00:00:00+09:00`
  let tsUntil: string | null = null
  if (until) {
    const endDate = new Date(until + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    tsUntil = endDate.toISOString()
  }

  try {
    // 1) ad_campaign_stats 조회 (stat_date DATE 컬럼)
    let query = supabase
      .from('ad_campaign_stats')
      .select('*')
      .gte('stat_date', since)
      .order('stat_date', { ascending: false })
    if (until) query = query.lte('stat_date', until)

    if (platform) query = query.eq('platform', platform)
    const filtered = applyClientFilter(query, { clientId, assignedClientIds })
    if (filtered === null) return apiSuccess({ stats: [], campaignLeadCounts: {} })
    query = filtered

    const { data, error } = await query
    if (error) {
      logger.error('ad_campaign_stats 조회 실패', error, { clientId })
      return apiSuccess({ stats: [], campaignLeadCounts: {} })
    }

    // 2) campaign_id별 리드 수 산출
    // leads.inflow_url의 utm_id 파라미터가 Meta campaign_id와 일치
    const campaignLeadCounts: Record<string, number> = {}

    let leadsQuery = supabase
      .from('leads')
      .select('inflow_url')
      .not('inflow_url', 'is', null)
      .gte('created_at', tsSince)
    if (tsUntil) leadsQuery = leadsQuery.lt('created_at', tsUntil)

    const filteredLeads = applyClientFilter(leadsQuery, { clientId, assignedClientIds })
    if (filteredLeads) leadsQuery = filteredLeads

    const { data: leadsData } = await leadsQuery

    for (const lead of leadsData || []) {
      const campId = extractUtmId(lead.inflow_url as string)
      if (campId) {
        campaignLeadCounts[campId] = (campaignLeadCounts[campId] || 0) + 1
      }
    }

    return apiSuccess({ stats: data, campaignLeadCounts })
  } catch (err) {
    logger.error('ads/stats 조회 실패', err, { clientId })
    return apiSuccess({ stats: [], campaignLeadCounts: {} })
  }
})
