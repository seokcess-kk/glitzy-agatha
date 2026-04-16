import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { getKstDateString, toUtcDate } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdsDayAnalysis')

const TZ = 'Asia/Seoul'
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 요일별 광고 성과 분석 API
 * - leads.created_at → KST 요일별 리드 수 집계
 * - ad_campaign_stats.stat_date → 요일별 광고 지출 집계
 * - day: 0(일) ~ 6(토), dayLabel: "일"~"토"
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
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
  if (emptyCheck === null) {
    return apiSuccess({ byDay: buildEmptyResult() })
  }

  try {
    // 1. 리드 created_at 조회
    let leadsQuery = supabase
      .from('leads')
      .select('created_at')
    const filteredLeads = applyClientFilter(leadsQuery, { clientId, assignedClientIds })
    if (filteredLeads === null) return apiSuccess({ byDay: buildEmptyResult() })
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 2. 광고 지출 stat_date + spend_amount 조회
    let adStatsQuery = supabase
      .from('ad_campaign_stats')
      .select('stat_date, spend_amount')
    const filteredAdStats = applyClientFilter(adStatsQuery, { clientId, assignedClientIds })
    if (filteredAdStats === null) return apiSuccess({ byDay: buildEmptyResult() })
    adStatsQuery = filteredAdStats
    if (dateStart) adStatsQuery = adStatsQuery.gte('stat_date', dateStart)
    if (dateEnd) adStatsQuery = adStatsQuery.lte('stat_date', dateEnd)

    const [leadsRes, adStatsRes] = await Promise.all([leadsQuery, adStatsQuery])

    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clientId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (adStatsRes.error) {
      logger.error('광고 통계 조회 실패', adStatsRes.error, { clientId })
      return apiError('광고 통계 조회 중 오류가 발생했습니다.', 500)
    }

    // 요일별 리드 수 집계 (KST 기준)
    // Intl.DateTimeFormat으로 KST 요일 추출 (0=일, 1=월, ..., 6=토)
    const dayOfWeekKst = (date: Date): number => {
      // 'narrow' weekday in 'en-US': Sun=0, Mon=1, ..., Sat=6
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).formatToParts(date)
      const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      return map[weekdayStr] ?? 0
    }

    const leadsByDay: number[] = Array(7).fill(0)
    for (const lead of leadsRes.data || []) {
      const d = toUtcDate(lead.created_at)
      leadsByDay[dayOfWeekKst(d)] += 1
    }

    // 요일별 광고 지출 집계 (stat_date는 YYYY-MM-DD 문자열, 날짜 자체가 KST 기준)
    const spendByDay: number[] = Array(7).fill(0)
    for (const row of adStatsRes.data || []) {
      // stat_date는 'YYYY-MM-DD' 형식 — Date 생성 시 로컬(KST) 기준 해석되도록 T00:00:00 없이 처리
      const d = new Date(row.stat_date + 'T00:00:00+09:00')
      const dayOfWeek = d.getUTCDay()  // UTC 기준 요일은 KST midnight (+09:00)와 동일
      spendByDay[dayOfWeek] += Number(row.spend_amount) || 0
    }

    const byDay = Array.from({ length: 7 }, (_, day) => {
      const leads = leadsByDay[day]
      const spend = spendByDay[day]
      return {
        day,
        dayLabel: DAY_LABELS[day],
        leads,
        spend,
        cpl: leads > 0 ? Math.round(spend / leads) : 0,
      }
    })

    return apiSuccess({ byDay })
  } catch (error) {
    logger.error('요일별 분석 API 오류', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

function buildEmptyResult() {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    dayLabel: DAY_LABELS[day],
    leads: 0,
    spend: 0,
    cpl: 0,
  }))
}
