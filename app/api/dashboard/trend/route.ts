import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { isDemoViewer, getDemoTrend } from '@/lib/demo-data'
import { PLATFORM_INFLOW_DEFAULTS, isApiPlatform } from '@/lib/platform'
import { fetchManualInflows } from '@/lib/manual-inflow'

const DAYS = 28 // 최근 4주

export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoTrend())

  const supabase = serverSupabase()
  const url = new URL(req.url)

  // 기간 결정 — startDate/endDate 우선, 없으면 최근 DAYS 일 폴백
  const today = getKstDateString()
  const startDate = url.searchParams.get('startDate') || getKstDateString(new Date(Date.now() - DAYS * 86400000))
  const endDate = url.searchParams.get('endDate') || today

  // 요청 기간의 모든 날짜를 빈 틀로 생성 (데이터 없는 날도 0으로)
  //   leads = 인입 카운트(actualLeads + 매체전환 채널의 conversions, 기존 응답 키 호환)
  interface TrendDay {
    date: string
    spend: number
    leads: number
    actualLeads: number
    mediaConversions: number
    inflowCount: number
  }
  const dayMap = new Map<string, TrendDay>()
  const start = new Date(startDate + 'T00:00:00+09:00')
  const end = new Date(endDate + 'T00:00:00+09:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = getKstDateString(new Date(d))
    dayMap.set(key, { date: key, spend: 0, leads: 0, actualLeads: 0, mediaConversions: 0, inflowCount: 0 })
  }

  // leads 의 created_at(timestamp) 범위 — KST 자정 [start, end+1) 다음날 00:00 exclusive
  const tsEndDate = new Date(endDate + 'T00:00:00+09:00')
  tsEndDate.setDate(tsEndDate.getDate() + 1)
  const tsEnd = tsEndDate.toISOString()

  // 광고 지출 + 리드 수 병렬 조회 — conversions / platform 추가 select 로 일별 매체 전환수 합산
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, platform, spend_amount, conversions')
    .gte('stat_date', startDate)
    .lte('stat_date', endDate)
    .order('stat_date')

  let leadQuery = supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', `${startDate}T00:00:00+09:00`)
    .lt('created_at', tsEnd)
    .order('created_at')

  const adFiltered = applyClientFilter(adQuery, { clientId, assignedClientIds })
  const leadFiltered = applyClientFilter(leadQuery, { clientId, assignedClientIds })

  if (adFiltered === null && leadFiltered === null) {
    // 클라이언트 배정 없어도 빈 날짜 틀은 반환
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
    adFiltered ? adQuery : Promise.resolve({ data: [] as { stat_date: string; platform: string; spend_amount: number; conversions: number | null }[], error: null }),
    leadFiltered ? leadQuery : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
    fetchManualInflows(supabase, {
      clientIds: manualClientIds,
      startDate,
      endDate,
    }),
  ])

  if (adRes.error) return apiError(adRes.error.message, 500)
  if (leadRes.error) return apiError(leadRes.error.message, 500)

  // KST 기준 YYYY-MM-DD 추출
  const toKstDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  }

  // 광고비 + 매체 전환수 일별 집계 (PLATFORM_INFLOW_DEFAULTS='media_conversion' 인 플랫폼만)
  for (const row of adRes.data || []) {
    const key = row.stat_date.slice(0, 10)
    const entry = dayMap.get(key)
    if (!entry) continue
    entry.spend += Number(row.spend_amount)
    const platform = row.platform
    // media_conversion / combined 매체만 conversions 합산 (lead_webhook 매체는 이중 집계 방지)
    if (isApiPlatform(platform) && PLATFORM_INFLOW_DEFAULTS[platform] !== 'lead_webhook') {
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

  // 인입 카운트 = actualLeads + mediaConversions + manualBoost. 기존 응답 키 `leads` 는 호환 위해 inflowCount 동일값
  for (const entry of dayMap.values()) {
    const manualBoost = manualBoostByDate.get(entry.date) || 0
    entry.inflowCount = entry.actualLeads + entry.mediaConversions + manualBoost
    entry.leads = entry.inflowCount
  }

  return apiSuccess([...dayMap.values()])
})
