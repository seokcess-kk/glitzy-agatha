import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { isDemoViewer, getDemoEfficiencyTrend } from '@/lib/demo-data'
import { getKstDateString } from '@/lib/date'
import { PLATFORM_INFLOW_DEFAULTS, isApiPlatform } from '@/lib/platform'
import { fetchManualInflows } from '@/lib/manual-inflow'

const DEFAULT_DAYS = 28

interface DayEntry {
  date: string
  spend: number
  clicks: number
  impressions: number
  actualLeads: number
  mediaConversions: number
  inflowCount: number
  leads: number // 호환 — inflowCount 동일값
  cpl: number
  cpc: number
  ctr: number
}

export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoEfficiencyTrend())
  const supabase = serverSupabase()
  const url = new URL(req.url)

  const today = getKstDateString()
  const startDate =
    url.searchParams.get('startDate') ||
    getKstDateString(new Date(Date.now() - DEFAULT_DAYS * 86400000))
  const endDate = url.searchParams.get('endDate') || today

  // 요청 기간의 모든 날짜를 빈 틀로 생성 (데이터 없는 날도 0으로)
  const dayMap = new Map<string, DayEntry>()
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = getKstDateString(new Date(d))
    dayMap.set(key, { date: key, spend: 0, clicks: 0, impressions: 0, actualLeads: 0, mediaConversions: 0, inflowCount: 0, leads: 0, cpl: 0, cpc: 0, ctr: 0 })
  }

  // Timestamp end: next day midnight exclusive
  const tsEndDate = new Date(endDate + 'T00:00:00+09:00')
  tsEndDate.setDate(tsEndDate.getDate() + 1)
  const tsEnd = tsEndDate.toISOString()

  // 광고 집계 쿼리 — 매체 전환 합산 위해 platform, conversions 추가
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, platform, spend_amount, clicks, impressions, conversions')
    .gte('stat_date', startDate)
    .lte('stat_date', endDate)
    .order('stat_date')

  // 리드 쿼리
  let leadQuery = supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', `${startDate}T00:00:00+09:00`)
    .lt('created_at', tsEnd)
    .order('created_at')

  const adFiltered = applyClientFilter(adQuery, { clientId, assignedClientIds })
  const leadFiltered = applyClientFilter(leadQuery, { clientId, assignedClientIds })

  // agency_staff 배정 클라이언트 0개 → 빈 날짜 틀 반환
  if (adFiltered === null && leadFiltered === null) {
    return apiSuccess([...dayMap.values()])
  }
  if (adFiltered) adQuery = adFiltered
  if (leadFiltered) leadQuery = leadFiltered

  // manual_inflows 보정값 — 일자별 합산 (채널 분리 없음 → 일자 total)
  const manualClientIds: number[] | null = clientId
    ? [clientId]
    : assignedClientIds !== null
    ? assignedClientIds
    : null

  const [adRes, leadRes, manualInflowRows] = await Promise.all([
    adFiltered
      ? adQuery
      : Promise.resolve({ data: [] as { stat_date: string; platform: string; spend_amount: number; clicks: number; impressions: number; conversions: number | null }[], error: null }),
    leadFiltered
      ? leadQuery
      : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
    fetchManualInflows(supabase, {
      clientIds: manualClientIds,
      startDate,
      endDate,
    }),
  ])

  if (adRes.error) return apiError(adRes.error.message, 500)
  if (leadRes.error) return apiError(leadRes.error.message, 500)

  // KST 기준 YYYY-MM-DD 추출 (리드는 timestamp이므로 KST 변환 필요)
  const toKstDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  }

  // 광고비/클릭/노출 + 매체 전환 일별 집계 (media_conversion 모드 플랫폼만 conversions 합산)
  for (const row of adRes.data || []) {
    const key = row.stat_date.slice(0, 10)
    const entry = dayMap.get(key)
    if (!entry) continue
    entry.spend += Number(row.spend_amount)
    entry.clicks += Number(row.clicks || 0)
    entry.impressions += Number(row.impressions || 0)
    // media_conversion / combined 매체만 conversions 합산 (lead_webhook 매체는 이중 집계 방지)
    if (isApiPlatform(row.platform) && PLATFORM_INFLOW_DEFAULTS[row.platform] !== 'lead_webhook') {
      entry.mediaConversions += Number(row.conversions || 0)
    }
  }

  // 실제 리드 일별 집계
  for (const row of leadRes.data || []) {
    const key = toKstDate(row.created_at)
    const entry = dayMap.get(key)
    if (entry) entry.actualLeads += 1
  }

  // 수동 보정값(manual_inflows) — 일자별 합산 (채널 무관, 모든 채널 합쳐서 더함)
  const manualBoostByDate = new Map<string, number>()
  for (const row of manualInflowRows) {
    manualBoostByDate.set(row.stat_date, (manualBoostByDate.get(row.stat_date) || 0) + row.count)
  }

  // 인입 + 파생 지표 계산 (manualBoost 합산)
  for (const entry of dayMap.values()) {
    const manualBoost = manualBoostByDate.get(entry.date) || 0
    entry.inflowCount = entry.actualLeads + entry.mediaConversions + manualBoost
    entry.leads = entry.inflowCount // 호환
    entry.cpl = entry.inflowCount > 0 ? Math.round(entry.spend / entry.inflowCount) : 0
    entry.cpc = entry.clicks > 0 ? Math.round(entry.spend / entry.clicks) : 0
    entry.ctr = entry.impressions > 0 ? Number(((entry.clicks / entry.impressions) * 100).toFixed(2)) : 0
  }

  return apiSuccess([...dayMap.values()])
})
