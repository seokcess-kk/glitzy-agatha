import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'

/**
 * 매출 귀속 — 결제 고객 여정 목록
 * 결제한 고객의 전체 여정(리드→예약→상담→결제)을 반환
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const channelFilter = url.searchParams.get('channel')
  const campaignFilter = url.searchParams.get('campaign')

  // DATE columns: KST date string
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null

  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clinicId, assignedClinicIds }

  // 결제 + 고객 정보 조회 (기간 필터)
  let paymentsQuery = supabase
    .from('payments')
    .select('id, payment_amount, payment_date, treatment_name, customer_id, customers(id, name, phone_number, first_source, first_campaign_id, created_at)')
    .order('payment_date', { ascending: false })
  paymentsQuery = applyClinicFilter(paymentsQuery, ctx)!
  if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
  if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

  const { data: payments } = await paymentsQuery

  if (!payments || payments.length === 0) {
    return apiSuccess([])
  }

  // 고객 ID 수집 + 채널/캠페인 필터
  const customerIds = new Set<number>()
  const customerPayments: Record<number, any[]> = {}

  for (const p of payments) {
    const customer = p.customers as any
    if (!customer) continue

    // 채널 필터
    if (channelFilter) {
      const ch = normalizeChannel(customer.first_source)
      if (ch !== channelFilter) continue
    }
    // 캠페인 필터
    if (campaignFilter && customer.first_campaign_id !== campaignFilter) continue

    customerIds.add(customer.id)
    if (!customerPayments[customer.id]) customerPayments[customer.id] = []
    customerPayments[customer.id].push({
      id: p.id,
      amount: Number(p.payment_amount),
      date: p.payment_date,
      treatment: p.treatment_name,
    })
  }

  if (customerIds.size === 0) {
    return apiSuccess([])
  }

  const ids = Array.from(customerIds)

  // 관련 리드 + 예약 + 상담 병렬 조회
  const [leadsRes, bookingsRes, consultRes] = await Promise.all([
    supabase.from('leads').select('id, customer_id, utm_source, utm_medium, utm_campaign, utm_content, chatbot_sent, chatbot_sent_at, created_at').in('customer_id', ids).order('created_at'),
    supabase.from('bookings').select('id, customer_id, status, booking_datetime, notes, created_at').in('customer_id', ids).order('created_at'),
    supabase.from('consultations').select('id, customer_id, status, consultation_date, notes, created_at').in('customer_id', ids).order('created_at'),
  ])

  // 고객 정보 맵
  const customerMap: Record<number, any> = {}
  for (const p of payments) {
    const c = p.customers as any
    if (c && customerIds.has(c.id)) {
      customerMap[c.id] = c
    }
  }

  // 관련 데이터를 customer_id 기준 Map으로 그룹핑 (O(N) vs O(N*M))
  const leadsMap = new Map<number, any[]>()
  for (const l of leadsRes.data || []) {
    if (!leadsMap.has(l.customer_id)) leadsMap.set(l.customer_id, [])
    leadsMap.get(l.customer_id)!.push(l)
  }
  const bookingsMap = new Map<number, any[]>()
  for (const b of bookingsRes.data || []) {
    if (!bookingsMap.has(b.customer_id)) bookingsMap.set(b.customer_id, [])
    bookingsMap.get(b.customer_id)!.push(b)
  }
  const consultMap = new Map<number, any[]>()
  for (const c of consultRes.data || []) {
    if (!consultMap.has(c.customer_id)) consultMap.set(c.customer_id, [])
    consultMap.get(c.customer_id)!.push(c)
  }

  // 고객별 여정 조립
  const result = ids.map(cid => {
    const customer = customerMap[cid]
    if (!customer) return null

    const leads = leadsMap.get(cid) || []
    const bookings = bookingsMap.get(cid) || []
    const consultations = consultMap.get(cid) || []
    const pmnts = customerPayments[cid] || []
    const totalRevenue = pmnts.reduce((s, p) => s + p.amount, 0)
    const firstLead = leads[0]

    return {
      customerId: cid,
      name: customer.name,
      phone: customer.phone_number,
      channel: normalizeChannel(customer.first_source),
      campaign: customer.first_campaign_id,
      firstLeadDate: firstLead?.created_at || customer.created_at,
      totalRevenue,
      payments: pmnts,
      journey: {
        leads,
        bookings,
        consultations,
        payments: pmnts,
      },
    }
  }).filter(Boolean)

  return apiSuccess(result)
})

