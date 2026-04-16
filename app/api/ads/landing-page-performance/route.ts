import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { isDemoViewer, getDemoLandingPagePerformance } from '@/lib/demo-data'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdsLandingPagePerformance')

/**
 * 랜딩페이지별 성과 분석 API
 * - landing_pages → leads(landing_page_id) → contact_id → payments
 * - 랜딩페이지별 리드 수, 결제 고객 수, 매출, 전환율 집계
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (isDemoViewer(user.role)) return apiSuccess(getDemoLandingPagePerformance())

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
  const emptyCheck = applyClientFilter(
    supabase.from('landing_pages').select('id', { count: 'exact', head: true }),
    { clientId, assignedClientIds }
  )
  if (emptyCheck === null) return apiSuccess({ pages: [] })

  try {
    // 1. 랜딩페이지 목록 조회
    let lpQuery = supabase
      .from('landing_pages')
      .select('id, name, is_active')
    const filteredLp = applyClientFilter(lpQuery, { clientId, assignedClientIds })
    if (filteredLp === null) return apiSuccess({ pages: [] })
    lpQuery = filteredLp

    // 2. 기간 내 리드 조회 (landing_page_id, contact_id)
    let leadsQuery = supabase
      .from('leads')
      .select('id, contact_id, landing_page_id, created_at')
    const filteredLeads = applyClientFilter(leadsQuery, { clientId, assignedClientIds })
    if (filteredLeads === null) return apiSuccess({ pages: [] })
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 3. 기간 내 결제 조회 (contact_id, payment_amount)
    let paymentsQuery = supabase
      .from('payments')
      .select('contact_id, payment_amount, payment_date')
    const filteredPayments = applyClientFilter(paymentsQuery, { clientId, assignedClientIds })
    if (filteredPayments === null) return apiSuccess({ pages: [] })
    paymentsQuery = filteredPayments
    if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
    if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

    const [lpRes, leadsRes, paymentsRes] = await Promise.all([lpQuery, leadsQuery, paymentsQuery])

    if (lpRes.error) {
      logger.error('랜딩페이지 조회 실패', lpRes.error, { clientId })
      return apiError('랜딩페이지 조회 중 오류가 발생했습니다.', 500)
    }
    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clientId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (paymentsRes.error) {
      logger.error('결제 조회 실패', paymentsRes.error, { clientId })
      return apiError('결제 조회 중 오류가 발생했습니다.', 500)
    }

    // 랜딩페이지별 리드 수 + contact→landingPageId 첫 유입 매핑
    const leadsByPage: Record<number, number> = {}
    const contactToPage = new Map<number, number>()
    for (const lead of leadsRes.data || []) {
      const pageId = lead.landing_page_id
      if (pageId == null) continue
      leadsByPage[pageId] = (leadsByPage[pageId] || 0) + 1
      // 고객의 첫 번째 랜딩페이지만 기록
      if (!contactToPage.has(lead.contact_id)) {
        contactToPage.set(lead.contact_id, pageId)
      }
    }

    // 랜딩페이지별 매출 + 결제 고객 수 집계
    const revenueByPage: Record<number, number> = {}
    const payingContactsByPage: Record<number, Set<number>> = {}
    for (const payment of paymentsRes.data || []) {
      const pageId = contactToPage.get(payment.contact_id)
      if (pageId == null) continue
      revenueByPage[pageId] = (revenueByPage[pageId] || 0) + (Number(payment.payment_amount) || 0)
      if (!payingContactsByPage[pageId]) {
        payingContactsByPage[pageId] = new Set()
      }
      payingContactsByPage[pageId].add(payment.contact_id)
    }

    // 결과 조합
    const pages = (lpRes.data || [])
      .map(lp => {
        const leads = leadsByPage[lp.id] || 0
        const contacts = payingContactsByPage[lp.id]?.size || 0
        const revenue = revenueByPage[lp.id] || 0

        return {
          landingPageId: lp.id,
          name: lp.name,
          isActive: lp.is_active,
          leads,
          contacts,
          revenue,
          conversionRate: leads > 0 ? Number(((contacts / leads) * 100).toFixed(1)) : 0,
        }
      })
      .sort((a, b) => b.leads - a.leads)

    return apiSuccess({ pages })
  } catch (error) {
    logger.error('랜딩페이지 성과 API 오류', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
