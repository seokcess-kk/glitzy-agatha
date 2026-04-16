import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { sourceToChannel } from '@/lib/platform'
import { getKstDateString } from '@/lib/date'

/**
 * 채널별 KPI 분석 API
 * utm_source 원본 기준 세분화 집계 (google_search, meta_feed 등)
 * 광고 지출은 platform(meta_ads) 기준 → sourceToChannel로 채널 매칭
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startParam = url.searchParams.get('startDate')
  const endParam = url.searchParams.get('endDate')
  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clinicId, assignedClinicIds }

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

  // 1. 리드 데이터 조회 (utm_source 포함) — KPI와 동일한 gte/lt 패턴
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, utm_source, created_at')
    .limit(5000)
  leadsQuery = applyClinicFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

  // 2. 광고 지출 데이터 — stat_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let adStatsQuery = supabase
    .from('ad_campaign_stats')
    .select('platform, spend_amount, clicks, impressions, stat_date')
  adStatsQuery = applyClinicFilter(adStatsQuery, ctx)!
  if (startKst) adStatsQuery = adStatsQuery.gte('stat_date', startKst)
  if (endKst) adStatsQuery = adStatsQuery.lte('stat_date', endKst)

  // 3. 결제 데이터 — payment_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let paymentsQuery = supabase
    .from('payments')
    .select('payment_amount, customer_id, payment_date')
    .limit(5000)
  paymentsQuery = applyClinicFilter(paymentsQuery, ctx)!
  if (startKst) paymentsQuery = paymentsQuery.gte('payment_date', startKst)
  if (endKst) paymentsQuery = paymentsQuery.lte('payment_date', endKst)

  const [leadsRes, adStatsRes, paymentsRes] = await Promise.all([
    leadsQuery,
    adStatsQuery,
    paymentsQuery,
  ])

  // 채널별 리드 집계 — 플랫폼 단위 통합 (Meta, Google 등)
  const leadsByChannel: Record<string, Set<number>> = {}
  const customerToChannel: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    const channel = normalizeChannel(lead.utm_source)

    if (!leadsByChannel[channel]) {
      leadsByChannel[channel] = new Set()
    }
    leadsByChannel[channel].add(lead.id)

    if (!customerToChannel.has(lead.customer_id)) {
      customerToChannel.set(lead.customer_id, channel)
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

  // 채널별 매출 집계
  const revenueByChannel: Record<string, number> = {}
  const payingCustomersByChannel: Record<string, Set<number>> = {}

  for (const payment of paymentsRes.data || []) {
    const channel = customerToChannel.get(payment.customer_id) || 'Unknown'
    revenueByChannel[channel] = (revenueByChannel[channel] || 0) + Number(payment.payment_amount)

    if (!payingCustomersByChannel[channel]) {
      payingCustomersByChannel[channel] = new Set()
    }
    payingCustomersByChannel[channel].add(payment.customer_id)
  }

  // 결과 생성 — 플랫폼 단위로 광고비 직접 매칭 (안분 불필요)
  const allChannels = Object.keys(leadsByChannel)

  const result = allChannels
    .filter(ch => ch !== 'Unknown' || leadsByChannel[ch]?.size > 0)
    .map(ch => {
      const leads = leadsByChannel[ch]?.size || 0
      const spend = spendByChannel[ch] || 0
      const revenue = revenueByChannel[ch] || 0
      const payingCustomers = payingCustomersByChannel[ch]?.size || 0
      const clicks = clicksByChannel[ch] || 0
      const impressions = impressionsByChannel[ch] || 0

      return {
        channel: ch,
        leads,
        spend,
        revenue,
        payingCustomers,
        clicks,
        impressions,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        conversionRate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
      }
    })
    .sort((a, b) => b.leads - a.leads)

  return apiSuccess(result)
})

