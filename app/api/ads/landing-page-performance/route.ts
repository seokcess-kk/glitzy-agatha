import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdsLandingPagePerformance')

/**
 * 랜딩페이지별 성과 분석 API
 * - landing_pages → leads(landing_page_id) → customer_id → payments
 * - 랜딩페이지별 리드 수, 결제 고객 수, 매출, 전환율 집계
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
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

  // agency_staff 배정 병원 0개 → 빈 결과
  const emptyCheck = applyClinicFilter(
    supabase.from('landing_pages').select('id', { count: 'exact', head: true }),
    { clinicId, assignedClinicIds }
  )
  if (emptyCheck === null) return apiSuccess({ pages: [] })

  try {
    // 1. 랜딩페이지 목록 조회
    let lpQuery = supabase
      .from('landing_pages')
      .select('id, name, is_active')
    const filteredLp = applyClinicFilter(lpQuery, { clinicId, assignedClinicIds })
    if (filteredLp === null) return apiSuccess({ pages: [] })
    lpQuery = filteredLp

    // 2. 기간 내 리드 조회 (landing_page_id, customer_id)
    let leadsQuery = supabase
      .from('leads')
      .select('id, customer_id, landing_page_id, created_at')
    const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
    if (filteredLeads === null) return apiSuccess({ pages: [] })
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 3. 기간 내 결제 조회 (customer_id, payment_amount)
    let paymentsQuery = supabase
      .from('payments')
      .select('customer_id, payment_amount, payment_date')
    const filteredPayments = applyClinicFilter(paymentsQuery, { clinicId, assignedClinicIds })
    if (filteredPayments === null) return apiSuccess({ pages: [] })
    paymentsQuery = filteredPayments
    if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
    if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

    const [lpRes, leadsRes, paymentsRes] = await Promise.all([lpQuery, leadsQuery, paymentsQuery])

    if (lpRes.error) {
      logger.error('랜딩페이지 조회 실패', lpRes.error, { clinicId })
      return apiError('랜딩페이지 조회 중 오류가 발생했습니다.', 500)
    }
    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clinicId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (paymentsRes.error) {
      logger.error('결제 조회 실패', paymentsRes.error, { clinicId })
      return apiError('결제 조회 중 오류가 발생했습니다.', 500)
    }

    // 랜딩페이지별 리드 수 + customer→landingPageId 첫 유입 매핑
    const leadsByPage: Record<number, number> = {}
    const customerToPage = new Map<number, number>()
    for (const lead of leadsRes.data || []) {
      const pageId = lead.landing_page_id
      if (pageId == null) continue
      leadsByPage[pageId] = (leadsByPage[pageId] || 0) + 1
      // 고객의 첫 번째 랜딩페이지만 기록
      if (!customerToPage.has(lead.customer_id)) {
        customerToPage.set(lead.customer_id, pageId)
      }
    }

    // 랜딩페이지별 매출 + 결제 고객 수 집계
    const revenueByPage: Record<number, number> = {}
    const payingCustomersByPage: Record<number, Set<number>> = {}
    for (const payment of paymentsRes.data || []) {
      const pageId = customerToPage.get(payment.customer_id)
      if (pageId == null) continue
      revenueByPage[pageId] = (revenueByPage[pageId] || 0) + (Number(payment.payment_amount) || 0)
      if (!payingCustomersByPage[pageId]) {
        payingCustomersByPage[pageId] = new Set()
      }
      payingCustomersByPage[pageId].add(payment.customer_id)
    }

    // 결과 조합
    const pages = (lpRes.data || [])
      .map(lp => {
        const leads = leadsByPage[lp.id] || 0
        const customers = payingCustomersByPage[lp.id]?.size || 0
        const revenue = revenueByPage[lp.id] || 0

        return {
          landingPageId: lp.id,
          name: lp.name,
          isActive: lp.is_active,
          leads,
          customers,
          revenue,
          conversionRate: leads > 0 ? Number(((customers / leads) * 100).toFixed(1)) : 0,
        }
      })
      .sort((a, b) => b.leads - a.leads)

    return apiSuccess({ pages })
  } catch (error) {
    logger.error('랜딩페이지 성과 API 오류', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
