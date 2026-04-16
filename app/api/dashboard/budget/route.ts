import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, apiSuccess, apiError } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'
import { isDemoViewer, getDemoBudget } from '@/lib/demo-data'

const logger = createLogger('DashboardBudget')

/**
 * 예산 소진 데이터 API
 * GET: client_id 기준 현재 월 예산, 소진 금액, 소진율, 예상 월말 지출
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoBudget())

  if (!clientId) {
    return apiSuccess({ monthlyBudget: 0, spentAmount: 0, burnRate: 0, projectedSpend: 0 })
  }

  const supabase = serverSupabase()

  try {
    // 1. clients.monthly_budget 조회
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('monthly_budget')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return apiSuccess({ monthlyBudget: 0, spentAmount: 0, burnRate: 0, projectedSpend: 0 })
    }

    const monthlyBudget = Number(client.monthly_budget) || 0
    if (monthlyBudget === 0) {
      return apiSuccess({ monthlyBudget: 0, spentAmount: 0, burnRate: 0, projectedSpend: 0 })
    }

    // 2. 현재 월 소진 금액 = ad_campaign_stats.spend_amount 합계
    const now = new Date()
    const kstToday = getKstDateString(now)
    const currentMonth = kstToday.slice(0, 7) // YYYY-MM
    const monthStart = `${currentMonth}-01`

    // 해당 월의 마지막 날 계산
    const year = parseInt(currentMonth.slice(0, 4))
    const month = parseInt(currentMonth.slice(5, 7))
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${currentMonth}-${String(lastDay).padStart(2, '0')}`

    const { data: adStats, error: adError } = await supabase
      .from('ad_campaign_stats')
      .select('spend_amount')
      .eq('client_id', clientId)
      .gte('stat_date', monthStart)
      .lte('stat_date', monthEnd)

    if (adError) {
      logger.error('ad_campaign_stats 조회 오류', adError, { clientId })
      return apiError('데이터 조회 실패', 500)
    }

    const spentAmount = (adStats || []).reduce((sum, row) => sum + Number(row.spend_amount || 0), 0)

    // 3. 소진율
    const burnRate = monthlyBudget > 0 ? Number(((spentAmount / monthlyBudget) * 100).toFixed(1)) : 0

    // 4. 예상 월말 지출 = 일 평균 소진 * 해당 월 일수
    const todayDate = parseInt(kstToday.slice(8, 10))
    const daysPassed = Math.max(todayDate, 1)
    const dailyAvg = spentAmount / daysPassed
    const projectedSpend = Math.round(dailyAvg * lastDay)

    return apiSuccess({
      monthlyBudget,
      spentAmount: Math.round(spentAmount),
      burnRate,
      projectedSpend,
    })
  } catch (error) {
    logger.error('예산 데이터 조회 실패', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
