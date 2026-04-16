import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { isDemoViewer, getDemoCreativesPerformance } from '@/lib/demo-data'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { normalizeChannel } from '@/lib/channel'

const logger = createLogger('CreativesPerformance')

interface AdStatsRow {
  ad_id: string | null
  ad_name: string | null
  platform: string | null
  campaign_id: string | null
  utm_content: string | null
  spend_amount: number
  clicks: number
  impressions: number
}

// inflow_url에서 utm_id (Meta campaign_id) 추출
function extractUtmId(inflowUrl: string | null): string | null {
  if (!inflowUrl) return null
  const match = inflowUrl.match(/utm_id=(\d+)/)
  return match?.[1] || null
}

/**
 * 소재별 성과 분석 API
 * utm_content 기반으로 리드/결제/매출 + 광고 지표(spend/clicks/impressions) 통합
 *
 * 광고 지표 매칭 전략:
 * 1차: ad_stats.utm_content 직접 매칭 (url_tags/effective_link 설정된 경우)
 * 2차: leads.inflow_url의 utm_id → campaign_id → ad_stats 캠페인별 집계 → 리드 비율 배분
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoCreativesPerformance())
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

  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess({ creatives: [] })
  }

  try {
    // 1) leads — utm_content가 있는 리드 (inflow_url도 포함)
    let leadsQuery = supabase
      .from('leads')
      .select('id, contact_id, utm_content, inflow_url, created_at')
      .not('utm_content', 'is', null)

    const filteredLeads = applyClientFilter(leadsQuery, { clientId, assignedClientIds })
    if (!filteredLeads) return apiSuccess({ creatives: [] })
    leadsQuery = filteredLeads

    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 2) ad_creatives — 소재 메타데이터
    let creativesQuery = supabase
      .from('ad_creatives')
      .select('id, name, utm_content, platform, landing_page_id, file_name, file_type')

    const filteredCreatives = applyClientFilter(creativesQuery, { clientId, assignedClientIds })
    if (filteredCreatives) creativesQuery = filteredCreatives

    // 3) payments — 리드 기준 귀속 (기간 필터 없음)
    let paymentsQuery = supabase
      .from('payments')
      .select('id, payment_amount, contact_id')

    const filteredPayments = applyClientFilter(paymentsQuery, { clientId, assignedClientIds })
    if (filteredPayments) paymentsQuery = filteredPayments

    // 4) ad_stats — campaign_id별 광고 지표 + utm_content별 직접 매칭 + ad_id별 (TikTok/Google)
    let adStatsQuery = supabase
      .from('ad_stats')
      .select('ad_id, ad_name, platform, campaign_id, utm_content, spend_amount, clicks, impressions')

    const filteredAdStats = applyClientFilter(adStatsQuery, { clientId, assignedClientIds })
    if (filteredAdStats) adStatsQuery = filteredAdStats
    if (dateStart) adStatsQuery = adStatsQuery.gte('stat_date', dateStart)
    if (dateEnd) adStatsQuery = adStatsQuery.lte('stat_date', dateEnd)

    // 병렬 쿼리 실행
    const [leadsRes, creativesRes, paymentsRes, adStatsRes] = await Promise.all([
      leadsQuery,
      creativesQuery,
      paymentsQuery,
      adStatsQuery,
    ])

    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clientId })
      return apiError('리드 데이터 조회 실패', 500)
    }
    if (creativesRes.error) {
      logger.warn('소재 메타데이터 조회 실패', { clientId, error: creativesRes.error.message })
    }
    if (paymentsRes.error) {
      logger.warn('결제 데이터 조회 실패', { clientId, error: paymentsRes.error.message })
    }
    if (adStatsRes.error) {
      logger.warn('ad_stats 조회 실패', { clientId, error: adStatsRes.error.message })
    }

    const leads = leadsRes.data || []
    const creatives = creativesRes.data || []
    const payments = paymentsRes.data || []
    const adStatsData: AdStatsRow[] = (adStatsRes.data || []) as AdStatsRow[]

    // utm_content → 소재 메타데이터 매핑
    const creativeMap = new Map<string, { name: string; platform: string | null; file_name: string | null; file_type: string | null }>()
    for (const c of creatives) {
      creativeMap.set(c.utm_content.toLowerCase(), {
        name: c.name,
        platform: c.platform,
        file_name: c.file_name || null,
        file_type: c.file_type || null,
      })
    }

    // utm_content별 리드 집계 + campaign_id 매핑 (inflow_url의 utm_id)
    const contentLeadMap = new Map<string, { leadIds: Set<number>; contactIds: Set<number> }>()
    const contentCampaignMap = new Map<string, Map<string, number>>() // utm_content → (campaign_id → count)

    for (const lead of leads) {
      const raw = lead.utm_content as string
      if (!raw) continue
      const content = raw.toLowerCase()
      if (!contentLeadMap.has(content)) {
        contentLeadMap.set(content, { leadIds: new Set(), contactIds: new Set() })
      }
      const entry = contentLeadMap.get(content)!
      entry.leadIds.add(lead.id)
      if (lead.contact_id) entry.contactIds.add(lead.contact_id)

      // campaign_id 매핑
      const campId = extractUtmId(lead.inflow_url as string)
      if (campId) {
        if (!contentCampaignMap.has(content)) contentCampaignMap.set(content, new Map())
        const campMap = contentCampaignMap.get(content)!
        campMap.set(campId, (campMap.get(campId) || 0) + 1)
      }
    }

    // contact_id → utm_content 매핑 (첫 리드 기준)
    const contactUtmContentMap = new Map<number, string>()
    for (const lead of leads) {
      if (lead.contact_id && lead.utm_content) {
        if (!contactUtmContentMap.has(lead.contact_id)) {
          contactUtmContentMap.set(lead.contact_id, (lead.utm_content as string).toLowerCase())
        }
      }
    }

    // utm_content별 결제 집계
    const contentPaymentMap = new Map<string, { payingContacts: Set<number>; revenue: number }>()
    for (const payment of payments) {
      const contactId = payment.contact_id
      if (!contactId) continue
      const utmContent = contactUtmContentMap.get(contactId)
      if (!utmContent) continue
      if (!contentPaymentMap.has(utmContent)) {
        contentPaymentMap.set(utmContent, { payingContacts: new Set(), revenue: 0 })
      }
      const entry = contentPaymentMap.get(utmContent)!
      entry.payingContacts.add(contactId)
      entry.revenue += Number(payment.payment_amount) || 0
    }

    // ad_stats: 1차 utm_content 직접 매칭, 2차 campaign_id별 집계
    const directUtmStats = new Map<string, { spend: number; clicks: number; impressions: number }>()
    const campaignStats = new Map<string, { spend: number; clicks: number; impressions: number }>()

    for (const row of adStatsData) {
      // 1차: utm_content가 있으면 직접 매칭
      if (row.utm_content) {
        const key = (row.utm_content as string).toLowerCase()
        const existing = directUtmStats.get(key) || { spend: 0, clicks: 0, impressions: 0 }
        existing.spend += Number(row.spend_amount) || 0
        existing.clicks += row.clicks || 0
        existing.impressions += row.impressions || 0
        directUtmStats.set(key, existing)
      }
      // campaign_id별 집계 (2차 폴백용)
      if (row.campaign_id) {
        const existing = campaignStats.get(row.campaign_id) || { spend: 0, clicks: 0, impressions: 0 }
        existing.spend += Number(row.spend_amount) || 0
        existing.clicks += row.clicks || 0
        existing.impressions += row.impressions || 0
        campaignStats.set(row.campaign_id, existing)
      }
    }

    // campaign_id별 전체 리드 수 사전 계산 (배분 비율용)
    const campTotalLeadsMap = new Map<string, number>()
    for (const [, cMap] of contentCampaignMap) {
      for (const [campId, count] of cMap) {
        campTotalLeadsMap.set(campId, (campTotalLeadsMap.get(campId) || 0) + count)
      }
    }

    // utm_content별 광고 지표 결정
    function getAdMetrics(utmContent: string): { spend: number; clicks: number; impressions: number } {
      // 1차: ad_stats utm_content 직접 매칭
      const direct = directUtmStats.get(utmContent)
      if (direct && direct.spend > 0) return direct

      // 2차: campaign별 지표를 리드 비율로 배분
      const campLeads = contentCampaignMap.get(utmContent)
      if (!campLeads || campLeads.size === 0) return { spend: 0, clicks: 0, impressions: 0 }

      let totalSpend = 0, totalClicks = 0, totalImpressions = 0

      for (const [campId, leadCount] of campLeads) {
        const campStat = campaignStats.get(campId)
        if (!campStat) continue

        const campTotalLeads = campTotalLeadsMap.get(campId) || 0
        if (campTotalLeads > 0) {
          const ratio = leadCount / campTotalLeads
          totalSpend += campStat.spend * ratio
          totalClicks += campStat.clicks * ratio
          totalImpressions += campStat.impressions * ratio
        }
      }

      return {
        spend: Math.round(totalSpend),
        clicks: Math.round(totalClicks),
        impressions: Math.round(totalImpressions),
      }
    }

    // 최종 조립: leads + ad_stats 모든 utm_content 포함
    const allUtmContents = new Set([...contentLeadMap.keys(), ...directUtmStats.keys()])

    const allCreatives: {
      utm_content: string; name: string; platform: string | null
      spend: number; clicks: number; impressions: number
      cpc: number; ctr: number; cpl: number
      leads: number; contacts: number; revenue: number; conversionRate: number
      registered: boolean; file_name: string | null; file_type: string | null
      campaign_ids: string[]
    }[] = []

    for (const utmContent of allUtmContents) {
      const creative = creativeMap.get(utmContent)
      const leadData = contentLeadMap.get(utmContent)
      const paymentData = contentPaymentMap.get(utmContent)
      const adMetrics = getAdMetrics(utmContent)

      const leadCount = leadData?.leadIds.size || 0
      const contactCount = paymentData?.payingContacts.size || 0
      const revenue = paymentData?.revenue || 0
      const conversionRate = leadCount > 0 ? Math.round((contactCount / leadCount) * 1000) / 10 : 0

      const { spend, clicks, impressions } = adMetrics

      // campaign_name 역매핑: contentCampaignMap의 campaign_id → ad_campaign_stats의 campaign_name
      const campIds = contentCampaignMap.get(utmContent)
      const campaignNames: string[] = []
      if (campIds) {
        for (const campId of campIds.keys()) {
          // adStatsData에서 해당 campaign_id의 campaign_name 찾기 (ad_campaign_stats와 동일)
          const matchedAd = adStatsData.find(a => a.campaign_id === campId)
          if (matchedAd) {
            // ad_stats에는 campaign_name이 없으므로, campaign_id만 사용
            campaignNames.push(campId)
          } else {
            campaignNames.push(campId)
          }
        }
      }

      allCreatives.push({
        utm_content: utmContent,
        name: creative?.name || utmContent,
        platform: creative ? normalizeChannel(creative.platform) : null,
        spend,
        clicks,
        impressions,
        cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpl: leadCount > 0 ? Math.round(spend / leadCount) : 0,
        leads: leadCount,
        contacts: contactCount,
        revenue,
        conversionRate,
        registered: !!creative,
        file_name: creative?.file_name || null,
        file_type: creative?.file_type || null,
        campaign_ids: campaignNames,
      })
    }

    // utm_content 없는 ad_stats (TikTok/Google 등) → ad_id 기준으로 별도 표시
    const adIdStats = new Map<string, { adName: string; platform: string; spend: number; clicks: number; impressions: number; campaignId: string | null }>()
    for (const row of adStatsData) {
      if (row.utm_content) continue // utm_content 있는 건 위에서 이미 처리
      if (!row.ad_id) continue
      const existing = adIdStats.get(row.ad_id)
      if (existing) {
        existing.spend += Number(row.spend_amount) || 0
        existing.clicks += row.clicks || 0
        existing.impressions += row.impressions || 0
      } else {
        adIdStats.set(row.ad_id, {
          adName: row.ad_name || row.ad_id,
          platform: row.platform || 'Unknown',
          spend: Number(row.spend_amount) || 0,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          campaignId: row.campaign_id || null,
        })
      }
    }

    for (const [adId, stats] of adIdStats) {
      if (stats.spend === 0 && stats.clicks === 0 && stats.impressions === 0) continue
      allCreatives.push({
        utm_content: adId,
        name: stats.adName,
        platform: normalizeChannel(stats.platform),
        spend: stats.spend,
        clicks: stats.clicks,
        impressions: stats.impressions,
        cpc: stats.clicks > 0 ? Math.round(stats.spend / stats.clicks) : 0,
        ctr: stats.impressions > 0 ? Math.round((stats.clicks / stats.impressions) * 10000) / 100 : 0,
        cpl: 0,
        leads: 0,
        contacts: 0,
        revenue: 0,
        conversionRate: 0,
        registered: false,
        file_name: null,
        file_type: null,
        campaign_ids: stats.campaignId ? [stats.campaignId] : [],
      })
    }

    // 지출 높은순 정렬, 동률 시 리드수 높은순
    allCreatives.sort((a, b) => b.spend - a.spend || b.leads - a.leads)

    return apiSuccess({ creatives: allCreatives })
  } catch (error) {
    logger.error('소재별 성과 조회 실패', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
