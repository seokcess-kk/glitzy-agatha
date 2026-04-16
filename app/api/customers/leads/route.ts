import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { getKstDateString } from '@/lib/date'
import { createLogger } from '@/lib/logger'

const logger = createLogger('CustomersLeads')

/**
 * 리드 목록 조회 API
 * - 필터: status, utm_source, date_from, date_to, campaign, page, per_page
 */
export const GET = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  const status = url.searchParams.get('status')
  const utmSource = url.searchParams.get('utm_source')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const campaign = url.searchParams.get('campaign')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10)))

  // Timestamp columns: KST midnight [start, end) pattern
  const tsStart = dateFrom ? `${getKstDateString(new Date(dateFrom))}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateTo) {
    const d = new Date(dateTo + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  let query = supabase
    .from('leads')
    .select(`
      *,
      contact:contacts(id, name, phone_number, first_source, total_conversions, total_conversion_value),
      landing_page:landing_pages(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiSuccess({ data: [], total: 0, page, per_page: perPage })
  query = filtered

  if (status && status !== 'all') query = query.eq('lead_status', status)
  if (utmSource && utmSource !== 'all') query = query.eq('utm_source', utmSource)
  if (campaign && campaign !== 'all') query = query.eq('utm_campaign', campaign)
  if (tsStart) query = query.gte('created_at', tsStart)
  if (tsEnd) query = query.lt('created_at', tsEnd)

  const { data: leads, error, count } = await query

  if (error) {
    logger.error('리드 목록 조회 실패', error, { clientId })
    return apiError('데이터 조회에 실패했습니다.', 500)
  }

  return apiSuccess({ data: leads || [], total: count || 0, page, per_page: perPage })
})

/**
 * 수동 리드 등록 API
 * - name, phone_number, utm_source (phone/visit/referral/other), memo
 */
export const POST = withClientFilter(async (req: Request, { user, clientId, assignedClientIds }: ClientContext) => {
  if (!clientId) return apiError('클라이언트를 선택해주세요.', 400)

  const supabase = serverSupabase()
  const body = await req.json()

  const name = sanitizeString(body.name, 50)
  const phoneNumber = sanitizeString(body.phone_number, 20)
  const utmSource = sanitizeString(body.utm_source, 20)
  const memo = body.memo ? sanitizeString(body.memo, 500) : null

  if (!name) return apiError('이름을 입력해주세요.', 400)
  if (!phoneNumber) return apiError('전화번호를 입력해주세요.', 400)

  // 전화번호 유효성 검증 (010 시작, 11자리)
  const digits = phoneNumber.replace(/[^0-9]/g, '')
  if (digits.length !== 11 || !digits.startsWith('010')) {
    return apiError('올바른 전화번호 형식이 아닙니다. (010으로 시작하는 11자리)', 400)
  }
  const normalizedPhone = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`

  const validSources = ['phone', 'visit', 'referral', 'other']
  if (!validSources.includes(utmSource || '')) {
    return apiError('유효하지 않은 유입 경로입니다.', 400)
  }

  // 기존 연락처 조회 (중복 감지)
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('phone_number', normalizedPhone)
    .maybeSingle()

  let contactId: number

  if (existingContact) {
    // 기존 연락처 있으면 재유입으로 처리
    contactId = existingContact.id
  } else {
    // 신규 연락처 생성
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        client_id: clientId,
        name,
        phone_number: normalizedPhone,
        first_source: utmSource,
      })
      .select('id')
      .single()

    if (contactError || !newContact) {
      logger.error('연락처 생성 실패', contactError, { clientId })
      return apiError('연락처 생성에 실패했습니다.', 500)
    }
    contactId = newContact.id
  }

  // 리드 생성
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      client_id: clientId,
      contact_id: contactId,
      utm_source: utmSource,
      lead_status: 'new',
      notes: memo,
      created_by: Number(user.id),
    })
    .select('id')
    .single()

  if (leadError || !lead) {
    logger.error('리드 생성 실패', leadError, { clientId })
    return apiError('리드 등록에 실패했습니다.', 500)
  }

  return apiSuccess({
    id: lead.id,
    contact_id: contactId,
    is_revisit: !!existingContact,
    existing_contact_name: existingContact?.name,
  }, 201)
})
