import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'

const DAYS = 28 // 최근 4주

export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoTrend } = await import('@/lib/demo/fixtures/aggregates')
    const url = new URL(req.url)
    return apiSuccess(demoTrend(clinicId, url.searchParams.get('startDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)

  // 오늘(KST)부터 28일 전까지 모든 날짜를 미리 생성
  const today = getKstDateString()
  const startDate = url.searchParams.get('startDate') || getKstDateString(new Date(Date.now() - DAYS * 86400000))

  // 28일 전~오늘까지 빈 날짜 틀 생성 (데이터 없는 날도 0으로)
  const dayMap = new Map<string, { date: string; spend: number; leads: number }>()
  for (let i = DAYS; i >= 0; i--) {
    const d = getKstDateString(new Date(Date.now() - i * 86400000))
    if (d >= startDate && d <= today) {
      dayMap.set(d, { date: d, spend: 0, leads: 0 })
    }
  }

  // 광고 지출 + 리드 수 병렬 조회
  let adQuery = supabase
    .from('ad_campaign_stats')
    .select('stat_date, spend_amount')
    .gte('stat_date', startDate)
    .lte('stat_date', today)
    .order('stat_date')

  let leadQuery = supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', startDate)
    .order('created_at')

  const adFiltered = applyClinicFilter(adQuery, { clinicId, assignedClinicIds })
  const leadFiltered = applyClinicFilter(leadQuery, { clinicId, assignedClinicIds })

  if (adFiltered === null && leadFiltered === null) {
    // 병원 배정 없어도 빈 날짜 틀은 반환
    return apiSuccess([...dayMap.values()])
  }
  if (adFiltered) adQuery = adFiltered
  if (leadFiltered) leadQuery = leadFiltered

  const [adRes, leadRes] = await Promise.all([
    adFiltered ? adQuery : Promise.resolve({ data: [] as { stat_date: string; spend_amount: number }[], error: null }),
    leadFiltered ? leadQuery : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
  ])

  if (adRes.error) return apiError(adRes.error.message, 500)
  if (leadRes.error) return apiError(leadRes.error.message, 500)

  // KST 기준 YYYY-MM-DD 추출
  const toKstDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  }

  // 광고비 일별 집계
  for (const row of adRes.data || []) {
    const key = row.stat_date.slice(0, 10)
    const entry = dayMap.get(key)
    if (entry) entry.spend += Number(row.spend_amount)
  }

  // 리드 일별 집계
  for (const row of leadRes.data || []) {
    const key = toKstDate(row.created_at)
    const entry = dayMap.get(key)
    if (entry) entry.leads += 1
  }

  return apiSuccess([...dayMap.values()])
})
