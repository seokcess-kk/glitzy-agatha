import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'

const logger = createLogger('AdsLandingPageAnalysis')

/**
 * 랜딩페이지별 심화 분석 API
 * - pages: 테이블 데이터 (리드, 예약, 결제, 매출, 전환율)
 * - trend: 일별 리드 추이 (상위 5개 LP)
 * - channelBreakdown: LP별 UTM source 채널 분석
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
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
  if (emptyCheck === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })

  try {
    // 1. 랜딩페이지 목록
    let lpQuery = supabase.from('landing_pages').select('id, name, is_active')
    const filteredLp = applyClinicFilter(lpQuery, { clinicId, assignedClinicIds })
    if (filteredLp === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    lpQuery = filteredLp

    // 2. 기간 내 리드 (landing_page_id, customer_id, utm_source, created_at)
    let leadsQuery = supabase
      .from('leads')
      .select('customer_id, landing_page_id, utm_source, created_at')
    const filteredLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
    if (filteredLeads === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 3. 기간 내 예약 (customer_id, status) — created_at 기준 (기존 API 패턴 동일)
    let bookingsQuery = supabase
      .from('bookings')
      .select('customer_id, status, created_at')
    const filteredBookings = applyClinicFilter(bookingsQuery, { clinicId, assignedClinicIds })
    if (filteredBookings === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    bookingsQuery = filteredBookings
    if (tsStart) bookingsQuery = bookingsQuery.gte('created_at', tsStart)
    if (tsEnd) bookingsQuery = bookingsQuery.lt('created_at', tsEnd)

    // 4. 기간 내 결제 (customer_id, payment_amount)
    let paymentsQuery = supabase
      .from('payments')
      .select('customer_id, payment_amount, payment_date')
    const filteredPayments = applyClinicFilter(paymentsQuery, { clinicId, assignedClinicIds })
    if (filteredPayments === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    paymentsQuery = filteredPayments
    if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
    if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

    const [lpRes, leadsRes, bookingsRes, paymentsRes] = await Promise.all([
      lpQuery, leadsQuery, bookingsQuery, paymentsQuery,
    ])

    if (lpRes.error) {
      logger.error('랜딩페이지 조회 실패', lpRes.error, { clinicId })
      return apiError('랜딩페이지 조회 중 오류가 발생했습니다.', 500)
    }
    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clinicId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (bookingsRes.error) {
      logger.error('예약 조회 실패', bookingsRes.error, { clinicId })
      return apiError('예약 조회 중 오류가 발생했습니다.', 500)
    }
    if (paymentsRes.error) {
      logger.error('결제 조회 실패', paymentsRes.error, { clinicId })
      return apiError('결제 조회 중 오류가 발생했습니다.', 500)
    }

    const landingPages = lpRes.data || []
    const leads = leadsRes.data || []
    const bookings = bookingsRes.data || []
    const payments = paymentsRes.data || []

    // LP 이름 맵
    const lpNameMap = new Map<number, string>()
    for (const lp of landingPages) {
      lpNameMap.set(lp.id, lp.name)
    }

    // 리드별 집계: LP별 리드 수, customer→LP 매핑, 일별 추이, 채널 분석
    const leadsByPage: Record<number, number> = {}
    const customerToPage = new Map<number, number>()
    const trendMap: Record<string, Record<number, number>> = {} // date → { lpId → count }
    const channelMap: Record<number, Record<string, number>> = {} // lpId → { channel → count }

    for (const lead of leads) {
      const pageId = lead.landing_page_id
      if (pageId == null) continue

      leadsByPage[pageId] = (leadsByPage[pageId] || 0) + 1

      // 고객의 첫 번째 랜딩페이지만 기록
      if (lead.customer_id && !customerToPage.has(lead.customer_id)) {
        customerToPage.set(lead.customer_id, pageId)
      }

      // 일별 추이
      const date = getKstDateString(new Date(lead.created_at))
      if (!trendMap[date]) trendMap[date] = {}
      trendMap[date][pageId] = (trendMap[date][pageId] || 0) + 1

      // 채널 분석
      const channel = normalizeChannel(lead.utm_source)
      if (!channelMap[pageId]) channelMap[pageId] = {}
      channelMap[pageId][channel] = (channelMap[pageId][channel] || 0) + 1
    }

    // 예약 집계: customer→booking count (cancelled 제외)
    const bookingCustomers = new Set<number>()
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue
      if (booking.customer_id) bookingCustomers.add(booking.customer_id)
    }

    // LP별 예약 수 집계
    const bookingsByPage: Record<number, Set<number>> = {}
    for (const customerId of bookingCustomers) {
      const pageId = customerToPage.get(customerId)
      if (pageId == null) continue
      if (!bookingsByPage[pageId]) bookingsByPage[pageId] = new Set()
      bookingsByPage[pageId].add(customerId)
    }

    // 결제 집계
    const revenueByPage: Record<number, number> = {}
    const payingCustomersByPage: Record<number, Set<number>> = {}
    for (const payment of payments) {
      const pageId = customerToPage.get(payment.customer_id)
      if (pageId == null) continue
      revenueByPage[pageId] = (revenueByPage[pageId] || 0) + (Number(payment.payment_amount) || 0)
      if (!payingCustomersByPage[pageId]) payingCustomersByPage[pageId] = new Set()
      payingCustomersByPage[pageId].add(payment.customer_id)
    }

    // pages 결과
    const pages = landingPages
      .map(lp => {
        const lpLeads = leadsByPage[lp.id] || 0
        const lpBookings = bookingsByPage[lp.id]?.size || 0
        const customers = payingCustomersByPage[lp.id]?.size || 0
        const revenue = revenueByPage[lp.id] || 0

        return {
          landingPageId: lp.id,
          name: lp.name,
          isActive: lp.is_active,
          leads: lpLeads,
          bookings: lpBookings,
          customers,
          revenue,
          leadToBookingRate: lpLeads > 0 ? Number(((lpBookings / lpLeads) * 100).toFixed(1)) : 0,
          conversionRate: lpLeads > 0 ? Number(((customers / lpLeads) * 100).toFixed(1)) : 0,
        }
      })
      .sort((a, b) => b.leads - a.leads)

    // trend 결과: 상위 5개 LP만 (이름 중복 시 id suffix 추가)
    const top5 = pages.slice(0, 5)
    const nameCount = new Map<string, number>()
    for (const p of top5) {
      nameCount.set(p.name, (nameCount.get(p.name) || 0) + 1)
    }
    const trendLabelMap = new Map<number, string>()
    const usedNames = new Map<string, number>()
    for (const p of top5) {
      let label = p.name
      if ((nameCount.get(p.name) || 0) > 1) {
        const idx = (usedNames.get(p.name) || 0) + 1
        usedNames.set(p.name, idx)
        label = `${p.name} (${idx})`
      }
      trendLabelMap.set(p.landingPageId, label)
    }

    const dates = Object.keys(trendMap).sort()
    const trend = dates.map(date => {
      const entry: Record<string, string | number> = { date }
      for (const p of top5) {
        const label = trendLabelMap.get(p.landingPageId) || p.name
        entry[label] = trendMap[date][p.landingPageId] || 0
      }
      return entry
    })

    // trendLabels: 프론트에서 pageNames으로 사용
    const trendLabels = top5.map(p => trendLabelMap.get(p.landingPageId) || p.name)

    // channelBreakdown 결과
    const channelBreakdown = pages
      .filter(p => channelMap[p.landingPageId])
      .map(p => {
        const channels = Object.entries(channelMap[p.landingPageId] || {})
          .map(([channel, leads]) => ({ channel, leads }))
          .sort((a, b) => b.leads - a.leads)
        return {
          landingPageId: p.landingPageId,
          name: p.name,
          channels,
        }
      })
      .filter(p => p.channels.length > 0)

    return apiSuccess({ pages, trend, trendLabels, channelBreakdown })
  } catch (error) {
    logger.error('랜딩페이지 분석 API 오류', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
