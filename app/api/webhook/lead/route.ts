import { serverSupabase } from '@/lib/supabase'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import { qstash } from '@/lib/qstash'
import {
  isValidPhoneNumber,
  isValidUrl,
  normalizePhoneNumber,
  sanitizeString,
  sanitizeUrl,
  parseId,
} from '@/lib/security'
import {
  parseUtmFromUrl,
  sanitizeUtmParams,
  mergeUtmParams,
  type UtmParams,
} from '@/lib/utm'
import { createLogger } from '@/lib/logger'
import { sendErrorAlert } from '@/lib/error-alert'
import { sendCapiEvent } from '@/lib/services/metaCapi'

const logger = createLogger('WebhookLead')

// raw 로그 상태 업데이트 (실패해도 메인 플로우를 막지 않음)
async function updateRawLog(
  supabase: ReturnType<typeof serverSupabase>,
  rawLogId: number | null,
  update: { status: string; lead_id?: number; error_message?: string }
) {
  if (!rawLogId) return
  try {
    await supabase
      .from('lead_raw_logs')
      .update({ ...update, processed_at: new Date().toISOString() })
      .eq('id', rawLogId)
  } catch (e) {
    logger.warn('raw 로그 업데이트 실패', { rawLogId, error: e })
  }
}

export async function POST(req: Request) {
  const supabase = serverSupabase()
  let rawLogId: number | null = null

  // --- body 파싱 ---
  let body: {
    name?: string
    phoneNumber?: string
    campaignId?: string
    source?: string
    inflowUrl?: string
    client_id?: number | string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    landing_page_id?: number | string
    custom_data?: Record<string, unknown>
    idempotency_key?: string
    event_id?: string
  }

  try {
    body = await req.json()
  } catch {
    return apiError('잘못된 요청 형식입니다.', 400)
  }

  // --- Layer 1: raw 로그 즉시 저장 ---
  try {
    // 멱등성 키가 있으면 중복 확인
    if (body.idempotency_key) {
      const { data: existing } = await supabase
        .from('lead_raw_logs')
        .select('id, status, lead_id')
        .eq('idempotency_key', body.idempotency_key)
        .single()

      if (existing) {
        // 이미 처리 완료된 요청이면 성공 응답 반환
        if (existing.status === 'processed') {
          return apiSuccess({
            success: true,
            message: '이미 처리된 요청입니다.',
            leadId: existing.lead_id,
            duplicate: true,
          })
        }
        // received/failed 상태면 재처리 진행 (rawLogId 설정)
        rawLogId = existing.id
      }
    }

    if (!rawLogId) {
      const { data: rawLog } = await supabase
        .from('lead_raw_logs')
        .insert({
          payload: body,
          status: 'received',
          client_id: body.client_id ? parseId(body.client_id) : null,
          idempotency_key: body.idempotency_key || null,
        })
        .select('id')
        .single()
      rawLogId = rawLog?.id ?? null
    }
  } catch (e) {
    // raw 로그 저장 실패는 메인 플로우를 막지 않음
    logger.warn('raw 로그 저장 실패', { error: e })
  }

  // --- 검증 ---
  const {
    name,
    phoneNumber,
    campaignId,
    source,
    inflowUrl,
    client_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_page_id,
    custom_data,
    event_id,
  } = body

  if (!phoneNumber) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: '전화번호 누락' })
    return apiError('전화번호는 필수입니다.', 400)
  }

  if (!isValidPhoneNumber(phoneNumber)) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: '전화번호 형식 오류' })
    return apiError('유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678 또는 01012345678)', 400)
  }

  if (inflowUrl && !isValidUrl(inflowUrl)) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: 'URL 형식 오류' })
    return apiError('유효하지 않은 URL 형식입니다.', 400)
  }

  if (client_id === undefined || client_id === null || client_id === '') {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: 'client_id 누락' })
    return apiError('client_id는 필수입니다.', 400)
  }

  const validClientId = parseId(client_id)
  if (validClientId === null) {
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: 'client_id 무효' })
    return apiError('유효하지 않은 client_id입니다.', 400)
  }

  // --- 데이터 가공 ---
  const normalizedPhone = normalizePhoneNumber(phoneNumber)
  const sanitizedName = name ? sanitizeString(name, 50) : undefined
  const sanitizedCampaignId = campaignId ? sanitizeString(campaignId, 100) : undefined
  const sanitizedSource = source ? sanitizeString(source, 50) : 'Unknown'

  const explicitUtm: Partial<UtmParams> = {
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  }
  const urlUtm = inflowUrl ? parseUtmFromUrl(inflowUrl) : {}
  const finalUtm = sanitizeUtmParams(mergeUtmParams(explicitUtm, urlUtm))
  const finalSource = finalUtm.utm_source || sanitizedSource

  // --- 처리 ---
  try {
    // 1. 고객 조회/생성 (client_id 기준으로 격리)
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('client_id', validClientId)
      .maybeSingle()

    let contact = existingContact
    if (!contact) {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          phone_number: normalizedPhone,
          name: sanitizedName,
          first_source: finalSource,
          first_campaign_id: finalUtm.utm_campaign || sanitizedCampaignId,
          client_id: validClientId,
        })
        .select()
        .single()
      if (error) throw error
      contact = newContact
    }

    // landing_page_id 유효성 검증
    let validLandingPageId: number | null = null
    if (landing_page_id) {
      validLandingPageId = parseId(landing_page_id)
    }

    // 2. 리드 생성
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        contact_id: contact.id,
        client_id: validClientId,
        utm_source: finalUtm.utm_source,
        utm_medium: finalUtm.utm_medium,
        utm_campaign: finalUtm.utm_campaign,
        utm_content: finalUtm.utm_content,
        utm_term: finalUtm.utm_term,
        campaign_id: sanitizedCampaignId,
        inflow_url: inflowUrl ? sanitizeUrl(inflowUrl, 500) : null,
        chatbot_sent: false,
        landing_page_id: validLandingPageId,
        custom_data: { ...(custom_data || {}), name: sanitizedName || undefined },
      })
      .select()
      .single()
    if (leadError) throw leadError

    // raw 로그 → processed
    await updateRawLog(supabase, rawLogId, { status: 'processed', lead_id: lead.id })

    // 3. SMS 알림 — fire-and-forget (응답 차단 방지, sendSmsWithLog가 내부에서 DB 로그+재시도 처리)
    ;(async () => {
      try {
        const { data: client } = await supabase
          .from('clients')
          .select('notify_phone, notify_phones, notify_enabled, name')
          .eq('id', validClientId)
          .single()

        if (client?.notify_enabled && process.env.SOLAPI_API_KEY) {
          const phones: string[] =
            (client.notify_phones && client.notify_phones.length > 0)
              ? client.notify_phones
              : (client.notify_phone ? [client.notify_phone] : [])

          if (phones.length > 0) {
            const { sendSmsWithLog } = await import('@/lib/solapi')
            const smsText = `[${client.name}] 상담 유입\n이름: ${sanitizedName || '미입력'}\n연락처: ${normalizedPhone}`
            const clientId = validClientId

            const results = await Promise.all(
              phones.map(phone =>
                sendSmsWithLog(supabase, {
                  to: phone,
                  text: smsText,
                  clientId,
                  leadId: lead.id,
                }).catch(() => ({ success: false, logId: undefined, error: 'catch' }))
              )
            )

            // 실패 건 재시도 스케줄 (QStash 3분 후)
            if (process.env.QSTASH_TOKEN) {
              for (const r of results) {
                if (!r.success && r.logId) {
                  await qstash.publishJSON({
                    url: `${process.env.NEXTAUTH_URL}/api/qstash/sms-retry`,
                    body: { logId: r.logId },
                    delay: 180,
                  }).catch(() => {})
                }
              }
            }
          }
        }
      } catch (e) {
        logger.warn('SMS 알림 발송 실패 (non-blocking)', { error: e, leadId: lead.id })
      }
    })()

    // 4. QStash 챗봇 스케줄 — 카카오 알림톡 API 연동 전까지 비활성화
    // if (process.env.QSTASH_TOKEN && process.env.KAKAO_API_KEY) {
    //   await qstash.publishJSON({
    //     url: `${process.env.NEXTAUTH_URL}/api/qstash/chatbot`,
    //     body: { leadId: lead.id, phoneNumber: normalizedPhone, name: sanitizedName },
    //     delay: 300,
    //   })
    // }

    // 5. Meta CAPI Lead 이벤트 전송 (async, non-blocking)
    // event_id 검증: UUID 형식이거나 100자 이내 영숫자+하이픈만 허용
    const isValidEventId = event_id && /^[a-zA-Z0-9\-]{1,100}$/.test(event_id)
    const capiEventId = isValidEventId ? event_id : crypto.randomUUID()
    sendCapiEvent(supabase, {
      clientId: validClientId,
      leadId: lead.id,
      eventName: 'Lead',
      eventId: capiEventId,
      userData: {
        phone: normalizedPhone,
        firstName: sanitizedName || undefined,
      },
      eventSourceUrl: inflowUrl ? sanitizeUrl(inflowUrl, 500) : undefined,
    }).catch((e) => {
      logger.warn('CAPI 전송 실패 (non-blocking)', { error: e, leadId: lead.id })
    })

    return apiSuccess({
      success: true,
      message: '리드가 등록되고 담당자 알림 및 챗봇 발송이 스케줄되었습니다.',
      leadId: lead.id,
      contactId: contact.id,
      isNewContact: !existingContact,
      utm: finalUtm,
      eventId: capiEventId,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error('리드 처리 실패', err as Error, { rawLogId, client_id: validClientId })
    await updateRawLog(supabase, rawLogId, { status: 'failed', error_message: errorMsg })
    sendErrorAlert('lead_webhook_fail', `리드 처리 실패: ${errorMsg}`, { rawLogId, client_id: validClientId }).catch(() => {})
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
