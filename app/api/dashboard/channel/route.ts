import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { sourceToChannel } from '@/lib/platform'
import { getKstDateString } from '@/lib/date'
import { isDemoViewer, getDemoChannel } from '@/lib/demo-data'

/**
 * 채널별 KPI 분석 API
 * utm_source 원본 기준 세분화 집계 (google_search, meta_feed 등)
 * 광고 지출은 platform(meta_ads) 기준 → sourceToChannel로 채널 매칭
 * 추가 컬럼: 전환율, 거부율, 보류율, 노쇼율
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoChannel())

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startParam = url.searchParams.get('startDate')
  const endParam = url.searchParams.get('endDate')
  // agency_staff 배정 클라이언트 0개 → 빈 결과
  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clientId, assignedClientIds }

  // KPI와 동일한 날짜 범위 변환: ISO → KST 기준 [start, end) 패턴
  const startKst = startParam ? getKstDateString(new Date(startParam)) : null
  const endKst = endParam ? getKstDateString(new Date(endParam)) : null
  // timestamp 컬럼(created_at)용: KST 자정 기준 [start, end)
  const tsStart = startKst ? `${startKst}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (endKst) {
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    tsEnd = endDate.toISOString()
  }

  // 1. 리드 데이터 조회 (utm_source + status 포함) — KPI와 동일한 gte/lt 패턴
  let leadsQuery = supabase
    .from('leads')
    .select('id, contact_id, utm_source, status, lost_reason, created_at')
    .limit(5000)
  leadsQuery = applyClientFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

  // 2. 광고 지출 데이터 — stat_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let adStatsQuery = supabase
    .from('ad_campaign_stats')
    .select('platform, spend_amount, clicks, impressions, stat_date')
  adStatsQuery = applyClientFilter(adStatsQuery, ctx)!
  if (startKst) adStatsQuery = adStatsQuery.gte('stat_date', startKst)
  if (endKst) adStatsQuery = adStatsQuery.lte('stat_date', endKst)

  const [leadsRes, adStatsRes] = await Promise.all([
    leadsQuery,
    adStatsQuery,
  ])

  // 채널별 리드 집계 — 플랫폼 단위 통합 (Meta, Google 등)
  const leadsByChannel: Record<string, Set<number>> = {}
  const contactToChannel: Map<number, string> = new Map()

  // 채널별 상태 카운트
  const statusByChannel: Record<string, {
    total: number
    converted: number
    lost: number
    hold: number
    noResponse: number
    invalid: number
  }> = {}

  for (const lead of leadsRes.data || []) {
    const channel = normalizeChannel(lead.utm_source)

    if (!leadsByChannel[channel]) {
      leadsByChannel[channel] = new Set()
    }
    leadsByChannel[channel].add(lead.id)

    if (!contactToChannel.has(lead.contact_id)) {
      contactToChannel.set(lead.contact_id, channel)
    }

    // 상태별 집계
    if (!statusByChannel[channel]) {
      statusByChannel[channel] = { total: 0, converted: 0, lost: 0, hold: 0, noResponse: 0, invalid: 0 }
    }
    statusByChannel[channel].total++

    if (lead.status === 'converted') statusByChannel[channel].converted++
    else if (lead.status === 'lost') statusByChannel[channel].lost++
    else if (lead.status === 'hold') statusByChannel[channel].hold++
    else if (lead.status === 'invalid') statusByChannel[channel].invalid++

    // 노쇼율 = lost_reason === 'no_response'
    if (lead.status === 'lost' && lead.lost_reason === 'no_response') {
      statusByChannel[channel].noResponse++
    }
  }

  // 광고 지출/클릭/노출 — 플랫폼 레벨 집계 (ad_campaign_stats.platform 기준)
  const spendByChannel: Record<string, number> = {}
  const clicksByChannel: Record<string, number> = {}
  const impressionsByChannel: Record<string, number> = {}
  for (const row of adStatsRes.data || []) {
    const channel = sourceToChannel(row.platform) // meta_ads → Meta
    spendByChannel[channel] = (spendByChannel[channel] || 0) + Number(row.spend_amount)
    clicksByChannel[channel] = (clicksByChannel[channel] || 0) + Number(row.clicks || 0)
    impressionsByChannel[channel] = (impressionsByChannel[channel] || 0) + Number(row.impressions || 0)
  }

  // 결과 생성 — 플랫폼 단위로 광고비 직접 매칭 (안분 불필요)
  const allChannels = Object.keys(leadsByChannel)

  const result = allChannels
    .filter(ch => ch !== 'Unknown' || leadsByChannel[ch]?.size > 0)
    .map(ch => {
      const leads = leadsByChannel[ch]?.size || 0
      const spend = spendByChannel[ch] || 0
      const clicks = clicksByChannel[ch] || 0
      const impressions = impressionsByChannel[ch] || 0

      const stats = statusByChannel[ch] || { total: 0, converted: 0, lost: 0, hold: 0, noResponse: 0, invalid: 0 }
      // 유효 리드 = 전체 - 무효
      const validLeads = stats.total - stats.invalid

      // 전환 금액 계산을 위한 revenue는 채널 API에서 직접 계산하지 않으므로 0
      // (ROAS는 이전 버전과의 호환을 위해 유지하되 spend 기반으로만 계산)
      const revenue = 0

      return {
        channel: ch,
        leads,
        spend,
        revenue,
        clicks,
        impressions,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
        roas: 0, // 전환 금액 없이는 계산 불가
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        conversionRate: validLeads > 0 ? Number(((stats.converted / validLeads) * 100).toFixed(1)) : 0,
        lostRate: validLeads > 0 ? Number(((stats.lost / validLeads) * 100).toFixed(1)) : 0,
        holdRate: validLeads > 0 ? Number(((stats.hold / validLeads) * 100).toFixed(1)) : 0,
        noshowRate: validLeads > 0 ? Number(((stats.noResponse / validLeads) * 100).toFixed(1)) : 0,
      }
    })
    .sort((a, b) => b.leads - a.leads)

  return apiSuccess(result)
})
