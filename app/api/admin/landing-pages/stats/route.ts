import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, apiError, apiSuccess, applyClientFilter } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'

/**
 * 랜딩 페이지별 성과 통계 API
 * - 리드 수, 예약 전환율, 결제 전환율, 매출
 * - leads 테이블 기준 (캠페인 리드 건수와 동일한 소스)
 *
 * Agatha 도메인:
 * - 매출: leads where status='converted' + conversion_value (status_changed_at 기준)
 * - 예약(booking_count) = 진행중 + 전환 리드 수
 *
 * 전환 시점은 leads.status_changed_at 사용. NULL 레거시 데이터는 누락될 수 있음
 * (TODO: 백필 마이그레이션 후 제거).
 */
export const GET = withClientFilter(async (req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startParam = url.searchParams.get('startDate')
  const endParam = url.searchParams.get('endDate')

  // agency_staff 배정 클라이언트 0개 → 빈 결과
  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clientId, assignedClientIds }

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

  // 1. 리드 조회 (landing_page_id 있는 것만) — status는 예약 카운트 계산에 사용
  let leadsQuery = supabase
    .from('leads')
    .select('id, contact_id, landing_page_id, utm_source, utm_campaign, status, created_at')
    .not('landing_page_id', 'is', null)
    .limit(5000)
  leadsQuery = applyClientFilter(leadsQuery, ctx)!
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

  // 2. 전환 리드 (매출 집계) — status_changed_at 기준
  let conversionsQuery = supabase
    .from('leads')
    .select('contact_id, conversion_value, status_changed_at')
    .eq('status', 'converted')
    .not('conversion_value', 'is', null)
    .limit(5000)
  conversionsQuery = applyClientFilter(conversionsQuery, ctx)!
  if (tsStart) conversionsQuery = conversionsQuery.gte('status_changed_at', tsStart)
  if (tsEnd) conversionsQuery = conversionsQuery.lt('status_changed_at', tsEnd)

  const [leadsRes, conversionsRes] = await Promise.all([
    leadsQuery,
    conversionsQuery,
  ])

  if (leadsRes.error) return apiError(leadsRes.error.message, 500)

  // 랜딩페이지별 리드 집계 + 예약 contact (in_progress/converted) 집계
  const lpStats: Record<number, {
    landing_page_id: number
    lead_count: number
    contacts: Set<number>
    booking_contacts: Set<number>
  }> = {}

  const contactToLp = new Map<number, number>()

  for (const lead of leadsRes.data || []) {
    const lpId = lead.landing_page_id
    if (!lpId) continue

    if (!lpStats[lpId]) {
      lpStats[lpId] = { landing_page_id: lpId, lead_count: 0, contacts: new Set(), booking_contacts: new Set() }
    }
    lpStats[lpId].lead_count++
    lpStats[lpId].contacts.add(lead.contact_id)

    // 예약 = 진행중 + 전환 (contact 단위 distinct)
    if ((lead.status === 'in_progress' || lead.status === 'converted') && lead.contact_id) {
      lpStats[lpId].booking_contacts.add(lead.contact_id)
    }

    if (!contactToLp.has(lead.contact_id)) {
      contactToLp.set(lead.contact_id, lpId)
    }
  }

  // 매출 집계 (전환 리드 기준)
  const revenueByLp: Record<number, number> = {}
  const payingByLp: Record<number, Set<number>> = {}
  for (const conv of conversionsRes.data || []) {
    const lpId = contactToLp.get(conv.contact_id)
    if (lpId) {
      revenueByLp[lpId] = (revenueByLp[lpId] || 0) + Number(conv.conversion_value)
      if (!payingByLp[lpId]) payingByLp[lpId] = new Set()
      payingByLp[lpId].add(conv.contact_id)
    }
  }

  // 결과 생성
  const result = Object.values(lpStats).map(stat => {
    const leads = stat.lead_count
    const bookings = stat.booking_contacts.size
    const revenue = revenueByLp[stat.landing_page_id] || 0
    const payingContacts = payingByLp[stat.landing_page_id]?.size || 0

    return {
      landing_page_id: stat.landing_page_id,
      lead_count: leads,
      booking_count: bookings,
      paying_contacts: payingContacts,
      revenue,
      booking_rate: leads > 0 ? Number(((bookings / leads) * 100).toFixed(1)) : 0,
      conversion_rate: leads > 0 ? Number(((payingContacts / leads) * 100).toFixed(1)) : 0,
    }
  })

  return apiSuccess(result)
})
