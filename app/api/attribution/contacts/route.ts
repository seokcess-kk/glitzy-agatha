import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiSuccess } from '@/lib/api-middleware'
import { normalizeChannel } from '@/lib/channel'
import { getKstDateString } from '@/lib/date'

/**
 * 매출 귀속 — 전환 고객 여정 목록
 * 전환된 고객(leads.status='converted')의 전체 리드 이력을 반환
 *
 * Agatha 도메인:
 * - payment(결제) 개념 → leads.conversion_value (전환 금액)
 * - booking/consultation 개념 → leads.status (in_progress = 상담중, converted = 전환)
 *
 * 전환 시점은 leads.status_changed_at 사용. NULL 레거시 데이터는 누락될 수 있음
 * (TODO: 백필 마이그레이션 후 제거).
 */
export const GET = withClientFilter(async (req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const channelFilter = url.searchParams.get('channel')
  const campaignFilter = url.searchParams.get('campaign')

  // KST 기준 [start, end) 패턴
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null
  const tsStart = dateStart ? `${dateStart}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateEnd) {
    const d = new Date(dateEnd + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  if (assignedClientIds !== null && assignedClientIds.length === 0) {
    return apiSuccess([])
  }

  const ctx = { clientId, assignedClientIds }

  // 전환 리드 조회 (기간 필터 — status_changed_at 기준)
  let convQuery = supabase
    .from('leads')
    .select('id, contact_id, conversion_value, status_changed_at, conversion_memo, contacts(id, name, phone_number, first_source, first_campaign_id, created_at)')
    .eq('status', 'converted')
    .not('conversion_value', 'is', null)
    .order('status_changed_at', { ascending: false })
  convQuery = applyClientFilter(convQuery, ctx)!
  if (tsStart) convQuery = convQuery.gte('status_changed_at', tsStart)
  if (tsEnd) convQuery = convQuery.lt('status_changed_at', tsEnd)

  const { data: conversions } = await convQuery

  if (!conversions || conversions.length === 0) {
    return apiSuccess([])
  }

  // 고객 ID 수집 + 채널/캠페인 필터
  const contactIds = new Set<number>()
  const contactConversions: Record<number, { id: number; amount: number; date: string | null; memo: string | null }[]> = {}

  for (const conv of conversions) {
    const contact = conv.contacts as unknown as {
      id: number
      name: string | null
      phone_number: string | null
      first_source: string | null
      first_campaign_id: string | null
      created_at: string
    } | null
    if (!contact) continue

    // 채널 필터
    if (channelFilter) {
      const ch = normalizeChannel(contact.first_source)
      if (ch !== channelFilter) continue
    }
    // 캠페인 필터
    if (campaignFilter && contact.first_campaign_id !== campaignFilter) continue

    contactIds.add(contact.id)
    if (!contactConversions[contact.id]) contactConversions[contact.id] = []
    contactConversions[contact.id].push({
      id: conv.id,
      amount: Number(conv.conversion_value),
      date: conv.status_changed_at,
      memo: conv.conversion_memo,
    })
  }

  if (contactIds.size === 0) {
    return apiSuccess([])
  }

  const ids = Array.from(contactIds)

  // 관련 리드 전체 조회 (각 고객의 모든 리드 = 여정)
  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, contact_id, utm_source, utm_medium, utm_campaign, utm_content, status, status_changed_at, conversion_value, lost_reason, conversion_memo, chatbot_sent, chatbot_sent_at, created_at')
    .in('contact_id', ids)
    .order('created_at')

  // 고객 정보 맵
  const contactMap: Record<number, {
    id: number
    name: string | null
    phone_number: string | null
    first_source: string | null
    first_campaign_id: string | null
    created_at: string
  }> = {}
  for (const conv of conversions) {
    const c = conv.contacts as unknown as {
      id: number
      name: string | null
      phone_number: string | null
      first_source: string | null
      first_campaign_id: string | null
      created_at: string
    } | null
    if (c && contactIds.has(c.id)) {
      contactMap[c.id] = c
    }
  }

  // 관련 데이터를 contact_id 기준 Map으로 그룹핑
  const leadsMap = new Map<number, typeof allLeads>()
  for (const l of allLeads || []) {
    if (!leadsMap.has(l.contact_id)) leadsMap.set(l.contact_id, [])
    leadsMap.get(l.contact_id)!.push(l)
  }

  // 고객별 여정 조립
  const result = ids.map(cid => {
    const contact = contactMap[cid]
    if (!contact) return null

    const leads = leadsMap.get(cid) || []
    const convs = contactConversions[cid] || []
    // 응답 호환성: 기존 payments/bookings/consultations 키 유지 (값은 leads 기반)
    const payments = convs.map(c => ({ id: c.id, amount: c.amount, date: c.date, memo: c.memo }))
    // 예약 = 진행중/전환 리드, 상담 = 진행중 리드
    const bookings = leads
      ? leads.filter(l => l.status === 'in_progress' || l.status === 'converted')
        .map(l => ({ id: l.id, contact_id: l.contact_id, status: l.status, created_at: l.created_at }))
      : []
    const consultations = leads
      ? leads.filter(l => l.status === 'in_progress')
        .map(l => ({ id: l.id, contact_id: l.contact_id, status: l.status, created_at: l.created_at }))
      : []
    const totalRevenue = convs.reduce((s, p) => s + p.amount, 0)
    const firstLead = leads?.[0]

    return {
      contactId: cid,
      name: contact.name,
      phone: contact.phone_number,
      channel: normalizeChannel(contact.first_source),
      campaign: contact.first_campaign_id,
      firstLeadDate: firstLead?.created_at || contact.created_at,
      totalRevenue,
      payments,
      journey: {
        leads: leads || [],
        bookings,
        consultations,
        payments,
      },
    }
  }).filter(Boolean)

  return apiSuccess(result)
})
