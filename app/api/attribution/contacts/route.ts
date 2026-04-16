import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'

/**
 * 매출 귀속 — 결제 고객 여정 목록
 * 결제한 고객의 전체 여정(리드→예약→상담→결제)을 반환
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const channelFilter = url.searchParams.get('channel')
  const campaignFilter = url.searchParams.get('campaign')

  // DATE columns: KST date string
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null

  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clientId, assignedClientIds }

  // 결제 + 고객 정보 조회 (기간 필터)
  let paymentsQuery = supabase
    .from('payments')
    .select('id, payment_amount, payment_date, treatment_name, contact_id, contacts(id, name, phone_number, first_source, first_campaign_id, created_at)')
    .order('payment_date', { ascending: false })
  paymentsQuery = applyClientFilter(paymentsQuery, ctx)!
  if (dateStart) paymentsQuery = paymentsQuery.gte('payment_date', dateStart)
  if (dateEnd) paymentsQuery = paymentsQuery.lte('payment_date', dateEnd)

  const { data: payments } = await paymentsQuery

  if (!payments || payments.length === 0) {
    return apiSuccess([])
  }

  // 고객 ID 수집 + 채널/캠페인 필터
  const contactIds = new Set<number>()
  const contactPayments: Record<number, any[]> = {}

  for (const p of payments) {
    const contact = p.contacts as any
    if (!contact) continue

    // 채널 필터
    if (channelFilter) {
      const ch = normalizeChannel(contact.first_source)
      if (ch !== channelFilter) continue
    }
    // 캠페인 필터
    if (campaignFilter && contact.first_campaign_id !== campaignFilter) continue

    contactIds.add(contact.id)
    if (!contactPayments[contact.id]) contactPayments[contact.id] = []
    contactPayments[contact.id].push({
      id: p.id,
      amount: Number(p.payment_amount),
      date: p.payment_date,
      treatment: p.treatment_name,
    })
  }

  if (contactIds.size === 0) {
    return apiSuccess([])
  }

  const ids = Array.from(contactIds)

  // 관련 리드 + 예약 + 상담 병렬 조회
  const [leadsRes, bookingsRes, consultRes] = await Promise.all([
    supabase.from('leads').select('id, contact_id, utm_source, utm_medium, utm_campaign, utm_content, chatbot_sent, chatbot_sent_at, created_at').in('contact_id', ids).order('created_at'),
    supabase.from('bookings').select('id, contact_id, status, booking_datetime, notes, created_at').in('contact_id', ids).order('created_at'),
    supabase.from('consultations').select('id, contact_id, status, consultation_date, notes, created_at').in('contact_id', ids).order('created_at'),
  ])

  // 고객 정보 맵
  const contactMap: Record<number, any> = {}
  for (const p of payments) {
    const c = p.contacts as any
    if (c && contactIds.has(c.id)) {
      contactMap[c.id] = c
    }
  }

  // 관련 데이터를 contact_id 기준 Map으로 그룹핑 (O(N) vs O(N*M))
  const leadsMap = new Map<number, any[]>()
  for (const l of leadsRes.data || []) {
    if (!leadsMap.has(l.contact_id)) leadsMap.set(l.contact_id, [])
    leadsMap.get(l.contact_id)!.push(l)
  }
  const bookingsMap = new Map<number, any[]>()
  for (const b of bookingsRes.data || []) {
    if (!bookingsMap.has(b.contact_id)) bookingsMap.set(b.contact_id, [])
    bookingsMap.get(b.contact_id)!.push(b)
  }
  const consultMap = new Map<number, any[]>()
  for (const c of consultRes.data || []) {
    if (!consultMap.has(c.contact_id)) consultMap.set(c.contact_id, [])
    consultMap.get(c.contact_id)!.push(c)
  }

  // 고객별 여정 조립
  const result = ids.map(cid => {
    const contact = contactMap[cid]
    if (!contact) return null

    const leads = leadsMap.get(cid) || []
    const bookings = bookingsMap.get(cid) || []
    const consultations = consultMap.get(cid) || []
    const pmnts = contactPayments[cid] || []
    const totalRevenue = pmnts.reduce((s, p) => s + p.amount, 0)
    const firstLead = leads[0]

    return {
      contactId: cid,
      name: contact.name,
      phone: contact.phone_number,
      channel: normalizeChannel(contact.first_source),
      campaign: contact.first_campaign_id,
      firstLeadDate: firstLead?.created_at || contact.created_at,
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

