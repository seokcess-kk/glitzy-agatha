import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { resolveInflowSourceForChannel, computeInflowCount } from '@/lib/inflow'
import { PLATFORM_INFLOW_DEFAULTS, isApiPlatform } from '@/lib/platform'
import { getKstDateString } from '@/lib/date'
import { isDemoViewer, getDemoCampaigns } from '@/lib/demo-data'

/**
 * 캠페인별 KPI 분석 API
 * Phase 2: leads.utm_campaign 기반 캠페인 성과 분석
 *
 * Agatha 도메인 매핑:
 * - 매출: leads where status='converted' + conversion_value (status_changed_at 기준)
 * - 예약 카운트: leads where status IN ('in_progress','converted')
 *
 * 전환 시점은 leads.status_changed_at 사용. NULL인 레거시 데이터는
 * 집계에서 누락될 수 있음 (TODO: 백필 마이그레이션 후 제거).
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoCampaigns())

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startParam = url.searchParams.get('startDate')
  const endParam = url.searchParams.get('endDate')
  const channel = url.searchParams.get('channel') // 특정 채널 필터 (선택)

  // agency_staff 배정 클라이언트 0개 → 빈 결과
  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clientId, assignedClientIds }

  // KPI와 동일한 날짜 범위 변환: ISO → KST 기준 [start, end) 패턴
  const startKst = startParam ? getKstDateString(new Date(startParam)) : null
  const endKst = endParam ? getKstDateString(new Date(endParam)) : null
  const tsStart = startKst ? `${startKst}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (endKst) {
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    tsEnd = endDate.toISOString()
  }

  // 1. 리드 데이터 조회 (utm_source, utm_campaign 포함)
  let leadsQuery = supabase
    .from('leads')
    .select('id, contact_id, utm_source, utm_campaign, utm_content, status, created_at')
    .not('utm_campaign', 'is', null) // 캠페인이 있는 리드만
    .limit(5000)
  leadsQuery = applyClientFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)
  if (channel) {
    leadsQuery = leadsQuery.ilike('utm_source', channel)
  }

  // 2. 광고 지출 데이터 (캠페인별) — stat_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  //    conversions 컬럼 추가 — 매체 전환 모드 플랫폼(네이버 SA 등) 인입 합산용
  let adStatsQuery = supabase
    .from('ad_campaign_stats')
    .select('campaign_name, campaign_id, platform, spend_amount, clicks, impressions, conversions, stat_date')
  adStatsQuery = applyClientFilter(adStatsQuery, ctx)!
  if (startKst) adStatsQuery = adStatsQuery.gte('stat_date', startKst)
  if (endKst) adStatsQuery = adStatsQuery.lte('stat_date', endKst)

  // 3. 전환 매출: leads where status='converted' + conversion_value (status_changed_at 기준)
  let conversionsQuery = supabase
    .from('leads')
    .select('contact_id, conversion_value, status_changed_at')
    .eq('status', 'converted')
    .not('conversion_value', 'is', null)
    .limit(5000)
  conversionsQuery = applyClientFilter(conversionsQuery, ctx)!
  if (tsStart) conversionsQuery = conversionsQuery.gte('status_changed_at', tsStart)
  if (tsEnd) conversionsQuery = conversionsQuery.lt('status_changed_at', tsEnd)

  const [leadsRes, adStatsRes, conversionsRes] = await Promise.all([
    leadsQuery,
    adStatsQuery,
    conversionsQuery,
  ])

  // 캠페인별 리드 집계
  const campaignStats: Record<string, {
    campaign: string
    channel: string
    leads: Set<number>
    contacts: Set<number>
    bookedContacts: Set<number>
  }> = {}

  const contactToCampaign: Map<number, string> = new Map()

  for (const lead of leadsRes.data || []) {
    const campaign = lead.utm_campaign || 'Unknown'
    const channel = normalizeChannel(lead.utm_source)

    if (!campaignStats[campaign]) {
      campaignStats[campaign] = {
        campaign,
        channel,
        leads: new Set(),
        contacts: new Set(),
        bookedContacts: new Set(),
      }
    }

    campaignStats[campaign].leads.add(lead.id)
    campaignStats[campaign].contacts.add(lead.contact_id)

    // 예약 = 진행중 + 전환 (캠페인별 booked 컨택트)
    if (lead.status === 'in_progress' || lead.status === 'converted') {
      campaignStats[campaign].bookedContacts.add(lead.contact_id)
    }

    // 고객의 첫 번째 캠페인 기록
    if (!contactToCampaign.has(lead.contact_id)) {
      contactToCampaign.set(lead.contact_id, campaign)
    }
  }

  // 광고 지출 집계 (campaign_name 또는 campaign_id 기준)
  //   + 매체 전환수 (media_conversion 모드 플랫폼만) 합산
  const spendByCampaign: Record<string, { spend: number; clicks: number; impressions: number; mediaConversions: number }> = {}
  for (const row of adStatsRes.data || []) {
    const campaignKey = row.campaign_name || row.campaign_id || 'Unknown'
    if (!spendByCampaign[campaignKey]) {
      spendByCampaign[campaignKey] = { spend: 0, clicks: 0, impressions: 0, mediaConversions: 0 }
    }
    spendByCampaign[campaignKey].spend += Number(row.spend_amount) || 0
    spendByCampaign[campaignKey].clicks += Number(row.clicks) || 0
    spendByCampaign[campaignKey].impressions += Number(row.impressions) || 0
    // 매체 전환 합산 — media_conversion / combined 모드 매체 (lead_webhook 매체는 이중 집계 방지)
    if (isApiPlatform(row.platform) && PLATFORM_INFLOW_DEFAULTS[row.platform] !== 'lead_webhook') {
      spendByCampaign[campaignKey].mediaConversions += Number(row.conversions) || 0
    }
  }

  // 캠페인별 매출 집계 (전환된 리드 기준)
  const revenueByCampaign: Record<string, number> = {}
  const payingContactsByCampaign: Record<string, Set<number>> = {}

  for (const conv of conversionsRes.data || []) {
    const campaign = contactToCampaign.get(conv.contact_id)
    if (campaign) {
      revenueByCampaign[campaign] = (revenueByCampaign[campaign] || 0) + Number(conv.conversion_value)

      if (!payingContactsByCampaign[campaign]) {
        payingContactsByCampaign[campaign] = new Set()
      }
      payingContactsByCampaign[campaign].add(conv.contact_id)
    }
  }

  // 결과 생성 — 인입 모델 적용
  //   inflowCount: 채널 inflowSource 에 따라 actualLeads 또는 mediaConversions 선택
  //   leads 키는 inflowCount 동일값으로 호환 유지
  const result = Object.values(campaignStats)
    .map(stat => {
      const actualLeads = stat.leads.size
      const adData = spendByCampaign[stat.campaign] || { spend: 0, clicks: 0, impressions: 0, mediaConversions: 0 }
      const spend = adData.spend
      const mediaConversions = adData.mediaConversions
      const inflowSource = resolveInflowSourceForChannel(stat.channel)
      const inflowCount = computeInflowCount(actualLeads, mediaConversions, inflowSource)
      const revenue = revenueByCampaign[stat.campaign] || 0
      const payingContacts = payingContactsByCampaign[stat.campaign]?.size || 0
      const bookings = stat.bookedContacts.size

      return {
        campaign: stat.campaign,
        channel: stat.channel,
        // 인입 4 필드
        actualLeads,
        mediaConversions,
        inflowCount,
        inflowSource,
        // 호환 — leads = inflowCount
        leads: inflowCount,
        bookings,
        payingContacts,
        spend,
        revenue,
        clicks: adData.clicks,
        impressions: adData.impressions,
        cpl: inflowCount > 0 ? Math.round(spend / inflowCount) : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
        roasPercent: spend > 0 ? Math.round((revenue / spend) * 100) : 0,
        bookingRate: inflowCount > 0 ? Number(((bookings / inflowCount) * 100).toFixed(1)) : 0,
        conversionRate: inflowCount > 0 ? Number(((payingContacts / inflowCount) * 100).toFixed(1)) : 0,
        ctr: adData.impressions > 0 ? Number(((adData.clicks / adData.impressions) * 100).toFixed(2)) : 0,
      }
    })
    .sort((a, b) => b.inflowCount - a.inflowCount) // 인입 많은 순
    .slice(0, 20) // 상위 20개

  return apiSuccess(result)
})
