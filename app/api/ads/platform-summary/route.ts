import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { apiToCreativePlatform, getSourceLabel, PLATFORM_INFLOW_DEFAULTS, isApiPlatform } from '@/lib/platform'
import { resolveInflowSourceForChannel, computeInflowCount } from '@/lib/inflow'
import { isDemoViewer, getDemoChannel } from '@/lib/demo-data'

const logger = createLogger('AdsPlatformSummary')

/**
 * 채널별 광고 성과 요약 API
 * - ad_campaign_stats에서 플랫폼별 spend/clicks/impressions 집계
 * - leads의 utm_source로 채널별 리드 수 집계
 * - 전환 리드(status='converted', conversion_value)를 contact→channel 매핑으로 채널별 매출 집계
 *
 * 전환 시점은 leads.status_changed_at 사용. NULL인 레거시 데이터는 누락될 수 있음
 * (TODO: 백필 마이그레이션 후 제거).
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoChannel())

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

  // agency_staff 배정 클라이언트 0개 → 빈 결과
  const emptyCheck = applyClientFilter(supabase.from('leads').select('id', { count: 'exact', head: true }), { clientId, assignedClientIds })
  if (emptyCheck === null) return apiSuccess([])

  try {
    // 1. 광고 통계 조회 — conversions 추가 (매체 전환 기반 인입용)
    let adStatsQuery = supabase
      .from('ad_campaign_stats')
      .select('platform, campaign_type, spend_amount, clicks, impressions, conversions, stat_date')
    const filteredAdStats = applyClientFilter(adStatsQuery, { clientId, assignedClientIds })
    if (filteredAdStats === null) return apiSuccess([])
    adStatsQuery = filteredAdStats
    if (dateStart) adStatsQuery = adStatsQuery.gte('stat_date', dateStart)
    if (dateEnd) adStatsQuery = adStatsQuery.lte('stat_date', dateEnd)

    // 2. 리드 조회 (utm_source, contact_id)
    let leadsQuery = supabase
      .from('leads')
      .select('id, contact_id, utm_source, created_at')
    const filteredLeads = applyClientFilter(leadsQuery, { clientId, assignedClientIds })
    if (filteredLeads === null) return apiSuccess([])
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 3. 전환 리드 조회 (contact_id, conversion_value) — status='converted' + conversion_value, status_changed_at 기준
    let conversionsQuery = supabase
      .from('leads')
      .select('contact_id, conversion_value, status_changed_at')
      .eq('status', 'converted')
      .not('conversion_value', 'is', null)
    const filteredConversions = applyClientFilter(conversionsQuery, { clientId, assignedClientIds })
    if (filteredConversions === null) return apiSuccess([])
    conversionsQuery = filteredConversions
    if (tsStart) conversionsQuery = conversionsQuery.gte('status_changed_at', tsStart)
    if (tsEnd) conversionsQuery = conversionsQuery.lt('status_changed_at', tsEnd)

    const [adStatsRes, leadsRes, conversionsRes] = await Promise.all([
      adStatsQuery,
      leadsQuery,
      conversionsQuery,
    ])

    if (adStatsRes.error) {
      logger.error('광고 통계 조회 실패', adStatsRes.error, { clientId })
      return apiError('광고 통계 조회 중 오류가 발생했습니다.', 500)
    }
    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clientId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (conversionsRes.error) {
      logger.error('전환 리드 조회 실패', conversionsRes.error, { clientId })
      return apiError('전환 리드 조회 중 오류가 발생했습니다.', 500)
    }

    // 채널별 광고 지출/클릭/노출 + 매체 전환 집계 (platform 기준) + 소스별 세분화
    type AdMetrics = { spend: number; clicks: number; impressions: number; mediaConversions: number }
    const adByChannel: Record<string, AdMetrics> = {}
    const adBySource: Record<string, Record<string, AdMetrics>> = {} // channel → source → metrics
    for (const row of adStatsRes.data || []) {
      const channel = normalizeChannel(row.platform)
      if (!adByChannel[channel]) {
        adByChannel[channel] = { spend: 0, clicks: 0, impressions: 0, mediaConversions: 0 }
      }
      adByChannel[channel].spend += Number(row.spend_amount) || 0
      adByChannel[channel].clicks += Number(row.clicks) || 0
      adByChannel[channel].impressions += Number(row.impressions) || 0
      // 매체 전환 — media_conversion 모드 플랫폼만
      const isMediaConvPlatform = isApiPlatform(row.platform) && PLATFORM_INFLOW_DEFAULTS[row.platform] === 'media_conversion'
      if (isMediaConvPlatform) {
        adByChannel[channel].mediaConversions += Number(row.conversions) || 0
      }

      // 소스별 세분화: platform_prefix + campaign_type → meta_feed, google_search 등
      const prefix = apiToCreativePlatform(row.platform)
      const sourceKey = row.campaign_type ? `${prefix}_${row.campaign_type}` : `${prefix}_etc`
      if (!adBySource[channel]) adBySource[channel] = {}
      if (!adBySource[channel][sourceKey]) {
        adBySource[channel][sourceKey] = { spend: 0, clicks: 0, impressions: 0, mediaConversions: 0 }
      }
      adBySource[channel][sourceKey].spend += Number(row.spend_amount) || 0
      adBySource[channel][sourceKey].clicks += Number(row.clicks) || 0
      adBySource[channel][sourceKey].impressions += Number(row.impressions) || 0
      if (isMediaConvPlatform) {
        adBySource[channel][sourceKey].mediaConversions += Number(row.conversions) || 0
      }
    }

    // 채널별 리드 집계 + 소스별 리드 집계 + contact→channel 첫 유입 채널 매핑
    const leadsByChannel: Record<string, number> = {}
    const leadsBySource: Record<string, Record<string, number>> = {} // channel → source → count
    const contactToChannel = new Map<number, string>()
    for (const lead of leadsRes.data || []) {
      const channel = normalizeChannel(lead.utm_source)
      const rawSource = lead.utm_source || 'unknown'
      leadsByChannel[channel] = (leadsByChannel[channel] || 0) + 1

      // 소스별 리드 집계
      if (!leadsBySource[channel]) leadsBySource[channel] = {}
      leadsBySource[channel][rawSource] = (leadsBySource[channel][rawSource] || 0) + 1

      if (!contactToChannel.has(lead.contact_id)) {
        contactToChannel.set(lead.contact_id, channel)
      }
    }

    // 채널별 매출 + 전환 고객 수 집계
    const revenueByChannel: Record<string, number> = {}
    const payingContactsByChannel: Record<string, Set<number>> = {}
    for (const conv of conversionsRes.data || []) {
      const channel = contactToChannel.get(conv.contact_id) || 'Unknown'
      revenueByChannel[channel] = (revenueByChannel[channel] || 0) + (Number(conv.conversion_value) || 0)
      if (!payingContactsByChannel[channel]) {
        payingContactsByChannel[channel] = new Set()
      }
      payingContactsByChannel[channel].add(conv.contact_id)
    }

    // 모든 채널 목록 (광고 채널 + 리드 채널 합집합)
    const allChannels = new Set([
      ...Object.keys(adByChannel),
      ...Object.keys(leadsByChannel),
    ])

    // 결과 조합 및 파생 지표 계산 — 인입 모델 적용
    const result = Array.from(allChannels)
      .filter(ch => ch !== 'Unknown' || (leadsByChannel[ch] || 0) > 0)
      .map(channel => {
        const adData = adByChannel[channel] || { spend: 0, clicks: 0, impressions: 0, mediaConversions: 0 }
        const { spend, clicks, impressions, mediaConversions } = adData
        const actualLeads = leadsByChannel[channel] || 0
        const inflowSource = resolveInflowSourceForChannel(channel)
        const inflowCount = computeInflowCount(actualLeads, mediaConversions, inflowSource)
        const revenue = revenueByChannel[channel] || 0
        const payingContacts = payingContactsByChannel[channel]?.size || 0

        // 소스별 세분화 데이터 생성 (UTM source 단위는 채널 inflowSource 그대로 적용)
        const adSources = adBySource[channel] || {}
        const leadSources = leadsBySource[channel] || {}
        const allSourceKeys = new Set([...Object.keys(adSources), ...Object.keys(leadSources)])
        const sources = Array.from(allSourceKeys)
          .map(src => {
            const ad = adSources[src] || { spend: 0, clicks: 0, impressions: 0, mediaConversions: 0 }
            const srcActualLeads = leadSources[src] || 0
            const srcInflow = computeInflowCount(srcActualLeads, ad.mediaConversions, inflowSource)
            const label = src.endsWith('_etc') ? '기타' : getSourceLabel(src)
            return {
              source: src,
              label: label === src ? src : label,
              spend: ad.spend,
              clicks: ad.clicks,
              impressions: ad.impressions,
              actualLeads: srcActualLeads,
              mediaConversions: ad.mediaConversions,
              inflowCount: srcInflow,
              leads: srcInflow, // 호환
              cpl: srcInflow > 0 ? Math.round(ad.spend / srcInflow) : 0,
              cpc: ad.clicks > 0 ? Math.round(ad.spend / ad.clicks) : 0,
              ctr: ad.impressions > 0 ? Number(((ad.clicks / ad.impressions) * 100).toFixed(2)) : 0,
            }
          })
          .sort((a, b) => b.inflowCount - a.inflowCount || b.spend - a.spend)

        return {
          channel,
          spend,
          clicks,
          impressions,
          // 인입 4 필드
          actualLeads,
          mediaConversions,
          inflowCount,
          inflowSource,
          leads: inflowCount, // 호환
          revenue,
          payingContacts,
          cpl: inflowCount > 0 ? Math.round(spend / inflowCount) : 0,
          cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
          ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
          roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
          conversionRate: inflowCount > 0 ? Number(((payingContacts / inflowCount) * 100).toFixed(1)) : 0,
          sources,
        }
      })
      .sort((a, b) => b.inflowCount - a.inflowCount)

    return apiSuccess(result)
  } catch (error) {
    logger.error('플랫폼 요약 API 오류', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
