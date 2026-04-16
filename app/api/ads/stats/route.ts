import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdsStats')

// inflow_url에서 utm_id (Meta campaign_id) 추출
function extractUtmId(inflowUrl: string | null): string | null {
  if (!inflowUrl) return null
  const match = inflowUrl.match(/utm_id=(\d+)/)
  return match?.[1] || null
}

export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const url = new URL(req.url)
  const daysParam = Number(url.searchParams.get('days') || 30)
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30
  const platform = url.searchParams.get('platform')

  if (user.role === 'demo_viewer') {
    const { demoAdStats } = await import('@/lib/demo/fixtures/aggregates')
    return apiSuccess(demoAdStats(clinicId, days, platform))
  }

  const supabase = serverSupabase()

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const since = getKstDateString(sinceDate)

  try {
    // 1) ad_campaign_stats 조회
    let query = supabase
      .from('ad_campaign_stats')
      .select('*')
      .gte('stat_date', since)
      .order('stat_date', { ascending: false })

    if (platform) query = query.eq('platform', platform)
    const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
    if (filtered === null) return apiSuccess({ stats: [], campaignLeadCounts: {} })
    query = filtered

    const { data, error } = await query
    if (error) {
      logger.error('ad_campaign_stats 조회 실패', error, { clinicId })
      return apiSuccess({ stats: [], campaignLeadCounts: {} })
    }

    // 2) campaign_id별 리드 수 산출
    // leads.inflow_url의 utm_id 파라미터가 Meta campaign_id와 일치
    const campaignLeadCounts: Record<string, number> = {}

    let leadsQuery = supabase
      .from('leads')
      .select('inflow_url')
      .not('inflow_url', 'is', null)
      .gte('created_at', since)

    const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
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
    logger.error('ads/stats 조회 실패', err, { clinicId })
    return apiSuccess({ stats: [], campaignLeadCounts: {} })
  }
})
