/**
 * Meta Conversions API (CAPI) 서비스
 * - 서버사이드 전환 이벤트 전송
 * - 병원별 Pixel ID/토큰 지원 (clinic_api_configs 또는 환경변수 폴백)
 * - SHA256 해싱으로 PII 보호
 * - capi_events 테이블에 전송 결과 로깅
 */

import { createLogger } from '@/lib/logger'
import { fetchJSON } from '@/lib/api-client'
import { sendErrorAlert } from '@/lib/error-alert'
import crypto from 'crypto'

const logger = createLogger('MetaCAPI')

type SupabaseClient = ReturnType<typeof import('@/lib/supabase').serverSupabase>

interface CapiUserData {
  phone?: string       // 원문 전화번호 (예: 01012345678)
  email?: string       // 원문 이메일
  firstName?: string   // 원문 이름
  clientIpAddress?: string
  clientUserAgent?: string
  fbc?: string         // _fbc 쿠키 값
  fbp?: string         // _fbp 쿠키 값
}

interface CapiEventParams {
  clinicId: number
  leadId?: number
  eventName?: string     // 기본값: 'Lead'
  eventId: string        // UUID (브라우저 Pixel과 중복 제거용)
  userData: CapiUserData
  eventSourceUrl?: string
  customData?: Record<string, unknown>
}

interface CapiConfig {
  pixelId: string
  accessToken: string
}

interface MetaCapiResponse {
  events_received?: number
  messages?: string[]
  fbtrace_id?: string
}

// SHA256 해싱 (Meta 요구사항: 소문자, 트리밍 후 해싱)
function sha256Hash(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex')
}

// 전화번호를 E.164 형식으로 정규화 후 해싱
function hashPhone(phone: string): string {
  // 숫자만 추출
  const digits = phone.replace(/\D/g, '')
  let e164 = digits
  // 이미 82로 시작하고 그 뒤에 10~19 (국번)이 오면 그대로 사용
  if (digits.startsWith('8201') || digits.startsWith('8211') || digits.startsWith('8216') || digits.startsWith('8217') || digits.startsWith('8218') || digits.startsWith('8219')) {
    e164 = digits
  } else if (digits.startsWith('01')) {
    // 한국 번호: 0XX → 82XX
    e164 = '82' + digits.slice(1)
  }
  return sha256Hash(e164)
}

/**
 * 병원별 Meta CAPI 설정 조회
 * 1. clinic_api_configs 테이블에서 병원별 설정
 * 2. 환경변수 폴백 (META_PIXEL_ID, META_ACCESS_TOKEN)
 */
async function getCapiConfig(
  supabase: SupabaseClient,
  clinicId: number
): Promise<CapiConfig | null> {
  // 1. 병원별 설정 조회
  try {
    const { data } = await supabase
      .from('clinic_api_configs')
      .select('config')
      .eq('clinic_id', clinicId)
      .eq('platform', 'meta_capi')
      .maybeSingle()

    if (data?.config) {
      const config = data.config as { pixel_id?: string; access_token?: string; enabled?: boolean }
      if (config.enabled !== false && config.pixel_id && config.access_token) {
        return { pixelId: config.pixel_id, accessToken: config.access_token }
      }
      // enabled: false면 CAPI 비활성화
      if (config.enabled === false) {
        logger.debug('CAPI disabled for clinic', { clinicId })
        return null
      }
    }
  } catch (e) {
    logger.warn('clinic_api_configs 조회 실패, 환경변수 폴백', { clinicId, error: e })
  }

  // 2. 환경변수 폴백
  const pixelId = process.env.META_PIXEL_ID
  const accessToken = process.env.META_ACCESS_TOKEN
  if (pixelId && accessToken) {
    return { pixelId, accessToken }
  }

  logger.warn('Meta CAPI 설정 없음', { clinicId })
  return null
}

/**
 * Meta Conversions API로 이벤트 전송
 * - non-blocking으로 호출하는 것을 권장 (.catch() 패턴)
 * - capi_events 테이블에 결과 로깅
 */
export async function sendCapiEvent(
  supabase: SupabaseClient,
  params: CapiEventParams
): Promise<{ success: boolean; eventLogId?: number; error?: string }> {
  const {
    clinicId,
    leadId,
    eventName = 'Lead',
    eventId,
    userData,
    eventSourceUrl,
    customData,
  } = params

  // 설정 조회
  const config = await getCapiConfig(supabase, clinicId)
  if (!config) {
    return { success: false, error: 'CAPI config not found' }
  }

  // 해싱된 user_data 구성
  const hashedUserData: Record<string, unknown> = {}
  let phoneHash: string | undefined
  let emailHash: string | undefined
  let fnHash: string | undefined

  if (userData.phone) {
    phoneHash = hashPhone(userData.phone)
    hashedUserData.ph = [phoneHash]
  }
  if (userData.email) {
    emailHash = sha256Hash(userData.email)
    hashedUserData.em = [emailHash]
  }
  if (userData.firstName) {
    fnHash = sha256Hash(userData.firstName)
    hashedUserData.fn = fnHash
  }
  if (userData.clientIpAddress) {
    hashedUserData.client_ip_address = userData.clientIpAddress
  }
  if (userData.clientUserAgent) {
    hashedUserData.client_user_agent = userData.clientUserAgent
  }
  if (userData.fbc) {
    hashedUserData.fbc = userData.fbc
  }
  if (userData.fbp) {
    hashedUserData.fbp = userData.fbp
  }

  // 이벤트 페이로드 구성
  const eventTime = Math.floor(Date.now() / 1000)
  const eventPayload = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl || undefined,
    user_data: hashedUserData,
    custom_data: customData || undefined,
  }

  // capi_events 로그 생성 (pending)
  let eventLogId: number | undefined
  try {
    const { data: logRow } = await supabase
      .from('capi_events')
      .insert({
        clinic_id: clinicId,
        lead_id: leadId || null,
        event_id: eventId,
        event_name: eventName,
        pixel_id: config.pixelId,
        user_phone_hash: phoneHash || null,
        user_email_hash: emailHash || null,
        user_fn_hash: fnHash || null,
        event_source_url: eventSourceUrl || null,
        status: 'pending',
      })
      .select('id')
      .single()
    eventLogId = logRow?.id as number | undefined
  } catch (e) {
    logger.warn('CAPI 이벤트 로그 생성 실패', { error: e })
  }

  // pixelId 검증 (숫자로만 구성되어야 함 — SSRF 방지)
  if (!/^\d{5,30}$/.test(config.pixelId)) {
    logger.error('Invalid pixel ID format', new Error('pixelId must be numeric'), {
      clinicId,
      pixelId: config.pixelId.slice(0, 10),
    })
    return { success: false, error: 'Invalid pixel ID format' }
  }

  // Meta Graph API 호출
  const url = `https://graph.facebook.com/v19.0/${config.pixelId}/events`

  const result = await fetchJSON<MetaCapiResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [eventPayload],
      access_token: config.accessToken,
      ...(process.env.META_TEST_EVENT_CODE && {
        test_event_code: process.env.META_TEST_EVENT_CODE,
      }),
    }),
    service: 'MetaCAPI',
    timeout: 15000,
    retries: 2,
  })

  // 결과 로깅
  const now = new Date().toISOString()
  if (result.success) {
    logger.info('CAPI event sent', {
      clinicId,
      leadId,
      eventName,
      eventId,
      eventsReceived: result.data?.events_received,
    })

    if (eventLogId) {
      try {
        await supabase
          .from('capi_events')
          .update({
            status: 'success',
            meta_response: result.data as Record<string, unknown>,
            sent_at: now,
          })
          .eq('id', eventLogId)
      } catch { /* non-blocking */ }
    }

    return { success: true, eventLogId }
  } else {
    logger.error('CAPI event failed', new Error(result.error || 'Unknown'), {
      clinicId,
      leadId,
      eventName,
      statusCode: result.statusCode,
    })

    if (eventLogId) {
      try {
        await supabase
          .from('capi_events')
          .update({
            status: 'fail',
            error_message: result.error,
            meta_response: { statusCode: result.statusCode, error: result.error },
            sent_at: now,
          })
          .eq('id', eventLogId)
      } catch { /* non-blocking */ }
    }

    // 에러 알림 (non-blocking)
    sendErrorAlert(
      'meta_capi_fail',
      `CAPI 전송 실패 (clinic: ${clinicId}): ${result.error}`,
      { clinicId, leadId, eventId }
    ).catch(() => {})

    return { success: false, eventLogId, error: result.error }
  }
}
