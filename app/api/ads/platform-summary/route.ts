import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { apiToCreativePlatform, getSourceLabel } from '@/lib/platform'

const logger = createLogger('AdsPlatformSummary')

/**
 * 채널별 광고 성과 요약 API
 * - ad_campaign_stats에서 플랫폼별 spend/clicks/impressions 집계
 * - leads의 utm_source로 채널별 리드 수 집계
 * - payments를 customer→channel 매핑을 통해 채널별 매출 집계
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoPlatformSummary } = await import('@/lib/demo/fixtures/aggregates')
    const url = new URL(req.url)
    return apiSuccess(demoPlatformSummary(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // DATE columns: KST date string
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null

  // Timestamp columns: KST midnight [start, end) pattern
  const tsStart = dateStart ? `${dateStart}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateEnd) {
    const d = new Date(dateEnd + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  // agency_staff 배정 병원 0개 → 빈 결과
  const emptyCheck = applyClinicFilter(supabase.from('leads').select('id', { count: 'exact', head: true }), { clinicId, assignedClinicIds })
  if (emptyCheck === null) return apiSuccess([])

  try {
    // 1. 광고 통계 조회 (platform, campaign_type, spend, clicks, impressions)
    let adStatsQuery = supabase
      .from('ad_campaign_stats')
      .select('platform, campaign_type, spend_amount, clicks, impressions, stat_date')
    const filteredAdStats = applyClinicFilter(adStatsQuery, { clinicId, assignedClinicIds })
    if (filteredAdStats === null) return apiSuccess([])
    adStatsQuery = filteredAdStats
    if (dateStart) adStatsQuery = adStatsQuery.gte('stat_date', dateStart)
    if (dateEnd) adStatsQuery = adStatsQuery.lte('stat_date', dateEnd)

    // 2. 리드 조회 (utm_source, customer_id)
    let leadsQuery = supabase
      .from('leads')
      .select('id, customer_id, utm_source, created_at')
    const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
    if (filteredLeads === null) return apiSuccess([])
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 3. 결제 조회 (customer_id, payment_amount)
    let paymentsQuery = supabase
      .from('payments')
      .select('customer_id, payment_amount, payment_date')
    const filteredPayments = applyClinicFilter(paymentsQuery, { clinicId, assignedClinicIds })
    if (filteredPayments === null) return apiSuccess([])
    paymentsQuery = filteredPayments
    if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
    if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

    const [adStatsRes, leadsRes, paymentsRes] = await Promise.all([
      adStatsQuery,
      leadsQuery,
      paymentsQuery,
    ])

    if (adStatsRes.error) {
      logger.error('광고 통계 조회 실패', adStatsRes.error, { clinicId })
      return apiError('광고 통계 조회 중 오류가 발생했습니다.', 500)
    }
    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clinicId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (paymentsRes.error) {
      logger.error('결제 조회 실패', paymentsRes.error, { clinicId })
      return apiError('결제 조회 중 오류가 발생했습니다.', 500)
    }

    // 채널별 광고 지출/클릭/노출 집계 (platform 기준) + 소스별 세분화
    type AdMetrics = { spend: number; clicks: number; impressions: number }
    const adByChannel: Record<string, AdMetrics> = {}
    const adBySource: Record<string, Record<string, AdMetrics>> = {} // channel → source → metrics
    for (const row of adStatsRes.data || []) {
      const channel = normalizeChannel(row.platform)
      if (!adByChannel[channel]) {
        adByChannel[channel] = { spend: 0, clicks: 0, impressions: 0 }
      }
      adByChannel[channel].spend += Number(row.spend_amount) || 0
      adByChannel[channel].clicks += Number(row.clicks) || 0
      adByChannel[channel].impressions += Number(row.impressions) || 0

      // 소스별 세분화: platform_prefix + campaign_type → meta_feed, google_search 등
      const prefix = apiToCreativePlatform(row.platform)
      const sourceKey = row.campaign_type ? `${prefix}_${row.campaign_type}` : `${prefix}_etc`
      if (!adBySource[channel]) adBySource[channel] = {}
      if (!adBySource[channel][sourceKey]) {
        adBySource[channel][sourceKey] = { spend: 0, clicks: 0, impressions: 0 }
      }
      adBySource[channel][sourceKey].spend += Number(row.spend_amount) || 0
      adBySource[channel][sourceKey].clicks += Number(row.clicks) || 0
      adBySource[channel][sourceKey].impressions += Number(row.impressions) || 0
    }

    // 채널별 리드 집계 + 소스별 리드 집계 + customer→channel 첫 유입 채널 매핑
    const leadsByChannel: Record<string, number> = {}
    const leadsBySource: Record<string, Record<string, number>> = {} // channel → source → count
    const customerToChannel = new Map<number, string>()
    for (const lead of leadsRes.data || []) {
      const channel = normalizeChannel(lead.utm_source)
      const rawSource = lead.utm_source || 'unknown'
      leadsByChannel[channel] = (leadsByChannel[channel] || 0) + 1

      // 소스별 리드 집계
      if (!leadsBySource[channel]) leadsBySource[channel] = {}
      leadsBySource[channel][rawSource] = (leadsBySource[channel][rawSource] || 0) + 1

      if (!customerToChannel.has(lead.customer_id)) {
        customerToChannel.set(lead.customer_id, channel)
      }
    }

    // 채널별 매출 + 결제 고객 수 집계
    const revenueByChannel: Record<string, number> = {}
    const payingCustomersByChannel: Record<string, Set<number>> = {}
    for (const payment of paymentsRes.data || []) {
      const channel = customerToChannel.get(payment.customer_id) || 'Unknown'
      revenueByChannel[channel] = (revenueByChannel[channel] || 0) + (Number(payment.payment_amount) || 0)
      if (!payingCustomersByChannel[channel]) {
        payingCustomersByChannel[channel] = new Set()
      }
      payingCustomersByChannel[channel].add(payment.customer_id)
    }

    // 모든 채널 목록 (광고 채널 + 리드 채널 합집합)
    const allChannels = new Set([
      ...Object.keys(adByChannel),
      ...Object.keys(leadsByChannel),
    ])

    // 결과 조합 및 파생 지표 계산
    const result = Array.from(allChannels)
      .filter(ch => ch !== 'Unknown' || (leadsByChannel[ch] || 0) > 0)
      .map(channel => {
        const { spend = 0, clicks = 0, impressions = 0 } = adByChannel[channel] || {}
        const leads = leadsByChannel[channel] || 0
        const revenue = revenueByChannel[channel] || 0
        const payingCustomers = payingCustomersByChannel[channel]?.size || 0

        // 소스별 세분화 데이터 생성
        const adSources = adBySource[channel] || {}
        const leadSources = leadsBySource[channel] || {}
        const allSourceKeys = new Set([...Object.keys(adSources), ...Object.keys(leadSources)])
        const sources = Array.from(allSourceKeys)
          .map(src => {
            const ad = adSources[src] || { spend: 0, clicks: 0, impressions: 0 }
            const srcLeads = leadSources[src] || 0
            const label = src.endsWith('_etc') ? '기타' : getSourceLabel(src)
            return {
              source: src,
              label: label === src ? src : label,
              spend: ad.spend,
              clicks: ad.clicks,
              impressions: ad.impressions,
              leads: srcLeads,
              cpl: srcLeads > 0 ? Math.round(ad.spend / srcLeads) : 0,
              cpc: ad.clicks > 0 ? Math.round(ad.spend / ad.clicks) : 0,
              ctr: ad.impressions > 0 ? Number(((ad.clicks / ad.impressions) * 100).toFixed(2)) : 0,
            }
          })
          .sort((a, b) => b.leads - a.leads || b.spend - a.spend)

        return {
          channel,
          spend,
          clicks,
          impressions,
          leads,
          revenue,
          payingCustomers,
          cpl: leads > 0 ? Math.round(spend / leads) : 0,
          cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
          ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
          roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
          conversionRate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
          sources,
        }
      })
      .sort((a, b) => b.leads - a.leads)

    return apiSuccess(result)
  } catch (error) {
    logger.error('플랫폼 요약 API 오류', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
