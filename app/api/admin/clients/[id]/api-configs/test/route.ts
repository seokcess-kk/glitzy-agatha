/**
 * 클라이언트별 광고 매체 API 연결 테스트
 * - POST: 저장된 API 키로 각 매체 연결 테스트 수행
 */

import { createHmac } from 'crypto'
import { GoogleAdsApi } from 'google-ads-api'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { parseId } from '@/lib/security'
import { decryptApiConfig } from '@/lib/crypto'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'
import { API_CONFIG_PLATFORMS, isApiPlatform, type ApiPlatform } from '@/lib/platform'

const logger = createLogger('ApiConfigTest')

const TEST_TIMEOUT = 15000

interface TestResult {
  success: boolean
  accountName?: string
  error?: string
  platform: string
}

/**
 * Meta Ads 연결 테스트
 * GET https://graph.facebook.com/v19.0/{account_id}?fields=name,account_status
 */
async function testMetaAds(config: Record<string, unknown>): Promise<TestResult> {
  const accountId = config.account_id as string | undefined
  const accessToken = config.access_token as string | undefined

  if (!accountId || !accessToken) {
    return { success: false, error: 'account_id와 access_token이 필요합니다.', platform: 'meta_ads' }
  }

  const url = `https://graph.facebook.com/v19.0/${accountId}?fields=name,account_status`

  const { response } = await fetchWithRetry(url, {
    timeout: TEST_TIMEOUT,
    retries: 0,
    service: 'MetaAdsTest',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    return { success: false, error: `Meta API 오류 (${response.status}): ${body}`, platform: 'meta_ads' }
  }

  const data = (await response.json()) as { name?: string; account_status?: number }
  return { success: true, accountName: data.name || 'Unknown', platform: 'meta_ads' }
}

/**
 * google-ads-api / 기타 라이브러리에서 던진 에러 객체를 사람이 읽을 수 있는 문자열로 변환.
 * google-ads-api는 { errors: [{ message, errorCode }], requestId } 형태를 던지므로
 * String(err) 시 "[object Object]"가 되는 문제를 방지.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    // google-ads-api: { errors: [{ message, errorCode }] }
    const errors = e.errors as Array<{ message?: string; errorCode?: unknown }> | undefined
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0]
      const code = first.errorCode ? ` (${JSON.stringify(first.errorCode)})` : ''
      if (first.message) return `${first.message}${code}`
    }
    // google-ads-api: failure 객체에서 추출
    const failure = e.failure as { errors?: Array<{ message?: string }> } | undefined
    if (failure?.errors?.[0]?.message) return failure.errors[0].message
    // 일반 객체
    if (typeof e.message === 'string') return e.message
    try {
      return JSON.stringify(error).slice(0, 500)
    } catch {
      return '알 수 없는 오류 (직렬화 실패)'
    }
  }
  return String(error)
}

/**
 * Google Ads 연결 테스트
 * customer.query('SELECT customer.descriptive_name FROM customer LIMIT 1')
 *
 * 같은 MCC 다중 클라이언트 운영을 위해, 클라이언트별 config 에 없는 공통 필드는
 * process.env.GOOGLE_ADS_* 로 fallback (lib/services/googleAds.ts:buildCustomer 와 동일).
 */
async function testGoogleAds(config: Record<string, unknown>): Promise<TestResult> {
  const clientId =
    (config.client_id as string | undefined) || process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret =
    (config.client_secret as string | undefined) || process.env.GOOGLE_ADS_CLIENT_SECRET
  const developerToken =
    (config.developer_token as string | undefined) || process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId =
    (config.customer_id as string | undefined) || process.env.GOOGLE_ADS_CUSTOMER_ID
  const refreshToken =
    (config.refresh_token as string | undefined) || process.env.GOOGLE_ADS_REFRESH_TOKEN
  const loginCustomerId =
    (config.login_customer_id as string | undefined) || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

  if (!clientId || !clientSecret || !developerToken || !customerId || !refreshToken) {
    const missing = [
      !clientId && 'client_id',
      !clientSecret && 'client_secret',
      !developerToken && 'developer_token',
      !customerId && 'customer_id',
      !refreshToken && 'refresh_token',
    ].filter(Boolean).join(', ')
    return {
      success: false,
      error: `필수 인증 정보가 비어있습니다 — ${missing}. 클라이언트 설정 또는 GOOGLE_ADS_* 환경변수를 확인하세요.`,
      platform: 'google_ads',
    }
  }

  // Customer ID 정규화 (하이픈 제거)
  const normalizedCustomerId = customerId.replace(/-/g, '')
  const normalizedLoginCustomerId = loginCustomerId?.replace(/-/g, '')

  try {
    const client = new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: developerToken,
    })

    const customer = client.Customer({
      customer_id: normalizedCustomerId,
      refresh_token: refreshToken,
      ...(normalizedLoginCustomerId ? { login_customer_id: normalizedLoginCustomerId } : {}),
    })

    const rows = await customer.query(
      'SELECT customer.descriptive_name FROM customer LIMIT 1'
    )

    const name = rows[0]?.customer?.descriptive_name || 'Unknown'
    return { success: true, accountName: name, platform: 'google_ads' }
  } catch (error) {
    logger.error('Google Ads 연결 테스트 실패 상세', error, {
      customerId: normalizedCustomerId,
      hasLoginCustomerId: !!normalizedLoginCustomerId,
    })
    return {
      success: false,
      error: extractErrorMessage(error),
      platform: 'google_ads',
    }
  }
}

/**
 * TikTok Ads 연결 테스트
 * GET https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=["{id}"]
 */
async function testTikTokAds(config: Record<string, unknown>): Promise<TestResult> {
  const advertiserId = config.advertiser_id as string | undefined
  const accessToken = config.access_token as string | undefined

  if (!advertiserId || !accessToken) {
    return { success: false, error: 'advertiser_id와 access_token이 필요합니다.', platform: 'tiktok_ads' }
  }

  const url = `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=["${advertiserId}"]`

  const { response } = await fetchWithRetry(url, {
    timeout: TEST_TIMEOUT,
    retries: 0,
    service: 'TikTokAdsTest',
    headers: { 'Access-Token': accessToken },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    return { success: false, error: `TikTok API 오류 (${response.status}): ${body}`, platform: 'tiktok_ads' }
  }

  const data = (await response.json()) as {
    code?: number
    message?: string
    data?: { list?: Array<{ advertiser_name?: string }> }
  }

  if (data.code !== 0) {
    return { success: false, error: `TikTok API 오류: ${data.message || 'Unknown'}`, platform: 'tiktok_ads' }
  }

  const name = data.data?.list?.[0]?.advertiser_name || 'Unknown'
  return { success: true, accountName: name, platform: 'tiktok_ads' }
}

/**
 * Naver Search Ads 연결 테스트
 * GET https://api.searchad.naver.com/ncc/campaigns
 * (HMAC-SHA256 시그니처 헤더 인증)
 */
async function testNaverAds(config: Record<string, unknown>): Promise<TestResult> {
  const customerId = config.customer_id as string | undefined
  const accessLicense = config.access_license as string | undefined
  const secretKey = config.secret_key as string | undefined

  if (!customerId || !accessLicense || !secretKey) {
    return {
      success: false,
      error: 'customer_id, access_license, secret_key가 모두 필요합니다.',
      platform: 'naver_ads',
    }
  }

  const uri = '/ncc/campaigns'
  const timestamp = String(Date.now())
  const signature = createHmac('sha256', secretKey)
    .update(`${timestamp}.GET.${uri}`)
    .digest('base64')

  const url = `https://api.searchad.naver.com${uri}`

  const { response } = await fetchWithRetry(url, {
    timeout: TEST_TIMEOUT,
    retries: 0,
    service: 'NaverAdsTest',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Timestamp': timestamp,
      'X-API-KEY': accessLicense,
      'X-Customer': customerId,
      'X-Signature': signature,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    return {
      success: false,
      error: `Naver API 오류 (${response.status}): ${body}`,
      platform: 'naver_ads',
    }
  }

  const data = (await response.json()) as Array<{ name?: string; nccCampaignId?: string }>
  // 첫 캠페인명을 accountName으로, 캠페인 없으면 customerId 표기
  const accountName = Array.isArray(data) && data.length > 0 && data[0].name
    ? data[0].name
    : `Customer ${customerId}`

  return { success: true, accountName, platform: 'naver_ads' }
}

/**
 * ADN(Across DN) 연결 테스트
 * GET https://manage.acrosspf.com/api/api_report/across_adn_api_report.php?start_date=...&end_date=...
 * (헤더 API-KEY)
 *
 * 인증만 검증하면 충분하므로 단일 일자(KST 오늘) 범위로 호출.
 * 응답이 배열이면 성공 — 빈 배열이라도 인증은 통과한 것으로 간주.
 */
async function testAdnAds(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = config.api_key as string | undefined

  if (!apiKey) {
    return { success: false, error: 'api_key가 필요합니다.', platform: 'adn_ads' }
  }

  const dateApi = getKstDateString(new Date()).replace(/-/g, '') // 'YYYYMMDD'
  const url = `https://manage.acrosspf.com/api/api_report/across_adn_api_report.php?start_date=${dateApi}&end_date=${dateApi}`

  const { response } = await fetchWithRetry(url, {
    timeout: TEST_TIMEOUT,
    retries: 0,
    service: 'AdnAdsTest',
    headers: {
      'API-KEY': apiKey,
      'content-type': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    return {
      success: false,
      error: `ADN API 오류 (${response.status}): ${body.slice(0, 200)}`,
      platform: 'adn_ads',
    }
  }

  const data = (await response.json().catch(() => null)) as unknown
  if (!Array.isArray(data)) {
    return {
      success: false,
      error: 'ADN API 응답 형식이 배열이 아닙니다.',
      platform: 'adn_ads',
    }
  }

  // 첫 캠페인명을 accountName 으로 사용 (오늘 데이터 없으면 'ADN Account')
  const firstDay = data[0] as { campaign?: Array<{ campaign_name?: string }> } | undefined
  const firstCampName = firstDay?.campaign?.[0]?.campaign_name
  const accountName = firstCampName || 'ADN Account'

  return { success: true, accountName, platform: 'adn_ads' }
}

/**
 * POST: 매체 연결 테스트 실행
 */
export const POST = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // pathname: /api/admin/clients/[id]/api-configs/test
  const clientsIdx = segments.indexOf('clients')
  const idSegment = segments[clientsIdx + 1]
  const clientId = parseId(idSegment)
  if (!clientId) return apiError('유효한 클라이언트 ID가 필요합니다.')

  let body: { platform?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.')
  }

  const { platform } = body

  if (!isApiPlatform(platform)) {
    return apiError(`허용되지 않는 플랫폼입니다. (${API_CONFIG_PLATFORMS.join(', ')})`)
  }

  const supabase = serverSupabase()

  // 저장된 설정 조회
  const { data: row, error: fetchError } = await supabase
    .from('client_api_configs')
    .select('config')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .maybeSingle()

  if (fetchError) {
    logger.error('설정 조회 실패', fetchError, { clientId, platform })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  if (!row?.config) {
    return apiError('해당 매체의 API 설정이 없습니다. 먼저 API 키를 저장해주세요.', 404)
  }

  // JSONB에서 꺼낸 값이 객체(평문)이면 직접 사용, 문자열(암호화)이면 복호화
  const rawConfig = row.config
  const config = typeof rawConfig === 'object' && rawConfig !== null
    ? rawConfig as Record<string, unknown>
    : decryptApiConfig(rawConfig as string)
  if (!config) {
    logger.error('설정 복호화 실패', new Error('decryptApiConfig returned null'), { clientId, platform })
    return apiError('API 설정 복호화에 실패했습니다.', 500)
  }

  let result: TestResult

  try {
    switch (platform as ApiPlatform) {
      case 'meta_ads':
        result = await testMetaAds(config)
        break
      case 'google_ads':
        result = await testGoogleAds(config)
        break
      case 'tiktok_ads':
        result = await testTikTokAds(config)
        break
      case 'naver_ads':
        result = await testNaverAds(config)
        break
      case 'adn_ads':
        result = await testAdnAds(config)
        break
      case 'kakao_ads':
      case 'dable_ads':
        result = { success: false, error: '연결 테스트가 아직 지원되지 않습니다. API 키만 저장됩니다.', platform }
        break
      default:
        return apiError('지원하지 않는 플랫폼입니다.')
    }
  } catch (error) {
    const message = extractErrorMessage(error)
    logger.error('연결 테스트 예외', error, { clientId, platform })
    result = { success: false, error: message, platform }
  }

  // 테스트 결과 DB 업데이트
  try {
    await supabase
      .from('client_api_configs')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_result: result.success ? 'success' : 'failed',
      })
      .eq('client_id', clientId)
      .eq('platform', platform)
  } catch (updateError) {
    logger.warn('테스트 결과 DB 업데이트 실패', { clientId, platform, error: updateError })
  }

  if (result.success) {
    logger.info('연결 테스트 성공', { clientId, platform, accountName: result.accountName })
    return apiSuccess({ success: true, accountName: result.accountName, platform })
  }

  logger.warn('연결 테스트 실패', { clientId, platform, error: result.error })
  return apiSuccess({ success: false, error: result.error, platform })
})
