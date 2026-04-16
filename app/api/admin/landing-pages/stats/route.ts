import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, apiError, apiSuccess, applyClinicFilter, applyDateRange } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'

/**
 * 랜딩 페이지별 성과 통계 API
 * - 리드 수, 예약 전환율, 결제 전환율, 매출
 * - leads 테이블 기준 (캠페인 리드 건수와 동일한 소스)
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
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
  const tsStart = startKst ? `${startKst}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (endKst) {
    const endDate = new Date(endKst + 'T00:00:00+09:00')
    endDate.setDate(endDate.getDate() + 1)
    tsEnd = endDate.toISOString()
  }

  // 1. 리드 조회 (landing_page_id 있는 것만)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, landing_page_id, utm_source, utm_campaign, created_at')
    .not('landing_page_id', 'is', null)
    .limit(5000)
  leadsQuery = applyClinicFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

  // 2. 결제 데이터 — payment_date(DATE 컬럼)는 KST 날짜 문자열로 비교
  let paymentsQuery = supabase
    .from('payments')
    .select('customer_id, payment_amount')
    .limit(5000)
  paymentsQuery = applyClinicFilter(paymentsQuery, ctx)!
  if (startKst) paymentsQuery = paymentsQuery.gte('payment_date', startKst)
  if (endKst) paymentsQuery = paymentsQuery.lte('payment_date', endKst)

  // 3. 예약 데이터
  let bookingsQuery = supabase
    .from('bookings')
    .select('customer_id, status')
    .limit(5000)
  bookingsQuery = applyClinicFilter(bookingsQuery, ctx)!
  if (tsStart) bookingsQuery = bookingsQuery.gte('created_at', tsStart)
  if (tsEnd) bookingsQuery = bookingsQuery.lt('created_at', tsEnd)

  const [leadsRes, paymentsRes, bookingsRes] = await Promise.all([
    leadsQuery,
    paymentsQuery,
    bookingsQuery,
  ])

  if (leadsRes.error) return apiError(leadsRes.error.message, 500)

  // 랜딩페이지별 리드 집계
  const lpStats: Record<number, {
    landing_page_id: number
    lead_count: number
    customers: Set<number>
  }> = {}

  const customerToLp = new Map<number, number>()

  for (const lead of leadsRes.data || []) {
    const lpId = lead.landing_page_id
    if (!lpId) continue

    if (!lpStats[lpId]) {
      lpStats[lpId] = { landing_page_id: lpId, lead_count: 0, customers: new Set() }
    }
    lpStats[lpId].lead_count++
    lpStats[lpId].customers.add(lead.customer_id)

    if (!customerToLp.has(lead.customer_id)) {
      customerToLp.set(lead.customer_id, lpId)
    }
  }

  // 예약 집계
  const bookingsByLp: Record<number, number> = {}
  for (const b of bookingsRes.data || []) {
    if (b.status === 'cancelled') continue
    const lpId = customerToLp.get(b.customer_id)
    if (lpId) bookingsByLp[lpId] = (bookingsByLp[lpId] || 0) + 1
  }

  // 매출 집계
  const revenueByLp: Record<number, number> = {}
  const payingByLp: Record<number, Set<number>> = {}
  for (const p of paymentsRes.data || []) {
    const lpId = customerToLp.get(p.customer_id)
    if (lpId) {
      revenueByLp[lpId] = (revenueByLp[lpId] || 0) + Number(p.payment_amount)
      if (!payingByLp[lpId]) payingByLp[lpId] = new Set()
      payingByLp[lpId].add(p.customer_id)
    }
  }

  // 결과 생성
  const result = Object.values(lpStats).map(stat => {
    const leads = stat.lead_count
    const bookings = bookingsByLp[stat.landing_page_id] || 0
    const revenue = revenueByLp[stat.landing_page_id] || 0
    const payingCustomers = payingByLp[stat.landing_page_id]?.size || 0

    return {
      landing_page_id: stat.landing_page_id,
      lead_count: leads,
      booking_count: bookings,
      paying_customers: payingCustomers,
      revenue,
      booking_rate: leads > 0 ? Number(((bookings / leads) * 100).toFixed(1)) : 0,
      conversion_rate: leads > 0 ? Number(((payingCustomers / leads) * 100).toFixed(1)) : 0,
    }
  })

  return apiSuccess(result)
})
