import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
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
  const emptyCheck = applyClientFilter(
    supabase.from('landing_pages').select('id', { count: 'exact', head: true }),
    { clientId, assignedClientIds }
  )
  if (emptyCheck === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })

  try {
    // 1. 랜딩페이지 목록
    let lpQuery = supabase.from('landing_pages').select('id, name, is_active')
    const filteredLp = applyClientFilter(lpQuery, { clientId, assignedClientIds })
    if (filteredLp === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    lpQuery = filteredLp

    // 2. 기간 내 리드 (landing_page_id, contact_id, utm_source, created_at)
    let leadsQuery = supabase
      .from('leads')
      .select('contact_id, landing_page_id, utm_source, created_at')
    const filteredLeads = applyClientFilter(leadsQuery, { clientId, assignedClientIds })
    if (filteredLeads === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    leadsQuery = filteredLeads
    if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
    if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

    // 3. 기간 내 예약 (contact_id, status) — created_at 기준 (기존 API 패턴 동일)
    let bookingsQuery = supabase
      .from('bookings')
      .select('contact_id, status, created_at')
    const filteredBookings = applyClientFilter(bookingsQuery, { clientId, assignedClientIds })
    if (filteredBookings === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    bookingsQuery = filteredBookings
    if (tsStart) bookingsQuery = bookingsQuery.gte('created_at', tsStart)
    if (tsEnd) bookingsQuery = bookingsQuery.lt('created_at', tsEnd)

    // 4. 기간 내 결제 (contact_id, payment_amount)
    let paymentsQuery = supabase
      .from('payments')
      .select('contact_id, payment_amount, payment_date')
    const filteredPayments = applyClientFilter(paymentsQuery, { clientId, assignedClientIds })
    if (filteredPayments === null) return apiSuccess({ pages: [], trend: [], trendLabels: [], channelBreakdown: [] })
    paymentsQuery = filteredPayments
    if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
    if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

    const [lpRes, leadsRes, bookingsRes, paymentsRes] = await Promise.all([
      lpQuery, leadsQuery, bookingsQuery, paymentsQuery,
    ])

    if (lpRes.error) {
      logger.error('랜딩페이지 조회 실패', lpRes.error, { clientId })
      return apiError('랜딩페이지 조회 중 오류가 발생했습니다.', 500)
    }
    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clientId })
      return apiError('리드 조회 중 오류가 발생했습니다.', 500)
    }
    if (bookingsRes.error) {
      logger.error('예약 조회 실패', bookingsRes.error, { clientId })
      return apiError('예약 조회 중 오류가 발생했습니다.', 500)
    }
    if (paymentsRes.error) {
      logger.error('결제 조회 실패', paymentsRes.error, { clientId })
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

    // 리드별 집계: LP별 리드 수, contact→LP 매핑, 일별 추이, 채널 분석
    const leadsByPage: Record<number, number> = {}
    const contactToPage = new Map<number, number>()
    const trendMap: Record<string, Record<number, number>> = {} // date → { lpId → count }
    const channelMap: Record<number, Record<string, number>> = {} // lpId → { channel → count }

    for (const lead of leads) {
      const pageId = lead.landing_page_id
      if (pageId == null) continue

      leadsByPage[pageId] = (leadsByPage[pageId] || 0) + 1

      // 고객의 첫 번째 랜딩페이지만 기록
      if (lead.contact_id && !contactToPage.has(lead.contact_id)) {
        contactToPage.set(lead.contact_id, pageId)
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

    // 예약 집계: contact→booking count (cancelled 제외)
    const bookingContacts = new Set<number>()
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue
      if (booking.contact_id) bookingContacts.add(booking.contact_id)
    }

    // LP별 예약 수 집계
    const bookingsByPage: Record<number, Set<number>> = {}
    for (const contactId of bookingContacts) {
      const pageId = contactToPage.get(contactId)
      if (pageId == null) continue
      if (!bookingsByPage[pageId]) bookingsByPage[pageId] = new Set()
      bookingsByPage[pageId].add(contactId)
    }

    // 결제 집계
    const revenueByPage: Record<number, number> = {}
    const payingContactsByPage: Record<number, Set<number>> = {}
    for (const payment of payments) {
      const pageId = contactToPage.get(payment.contact_id)
      if (pageId == null) continue
      revenueByPage[pageId] = (revenueByPage[pageId] || 0) + (Number(payment.payment_amount) || 0)
      if (!payingContactsByPage[pageId]) payingContactsByPage[pageId] = new Set()
      payingContactsByPage[pageId].add(payment.contact_id)
    }

    // pages 결과
    const pages = landingPages
      .map(lp => {
        const lpLeads = leadsByPage[lp.id] || 0
        const lpBookings = bookingsByPage[lp.id]?.size || 0
        const contacts = payingContactsByPage[lp.id]?.size || 0
        const revenue = revenueByPage[lp.id] || 0

        return {
          landingPageId: lp.id,
          name: lp.name,
          isActive: lp.is_active,
          leads: lpLeads,
          bookings: lpBookings,
          contacts,
          revenue,
          leadToBookingRate: lpLeads > 0 ? Number(((lpBookings / lpLeads) * 100).toFixed(1)) : 0,
          conversionRate: lpLeads > 0 ? Number(((contacts / lpLeads) * 100).toFixed(1)) : 0,
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
    logger.error('랜딩페이지 분석 API 오류', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
