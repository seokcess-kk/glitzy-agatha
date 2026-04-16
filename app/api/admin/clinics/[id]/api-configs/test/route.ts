/**
 * 병원별 광고 매체 API 연결 테스트
 * - POST: 저장된 API 키로 각 매체 연결 테스트 수행
 */

import { GoogleAdsApi } from 'google-ads-api'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { parseId } from '@/lib/security'
import { decryptApiConfig } from '@/lib/crypto'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
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
 * Google Ads 연결 테스트
 * customer.query('SELECT customer.descriptive_name FROM customer LIMIT 1')
 */
async function testGoogleAds(config: Record<string, unknown>): Promise<TestResult> {
  const clientId = config.client_id as string | undefined
  const clientSecret = config.client_secret as string | undefined
  const developerToken = config.developer_token as string | undefined
  const customerId = config.customer_id as string | undefined
  const refreshToken = config.refresh_token as string | undefined

  if (!clientId || !clientSecret || !developerToken || !customerId || !refreshToken) {
    return {
      success: false,
      error: 'client_id, client_secret, developer_token, customer_id, refresh_token이 모두 필요합니다.',
      platform: 'google_ads',
    }
  }

  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  })

  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
  })

  const rows = await customer.query(
    'SELECT customer.descriptive_name FROM customer LIMIT 1'
  )

  const name = rows[0]?.customer?.descriptive_name || 'Unknown'
  return { success: true, accountName: name, platform: 'google_ads' }
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
 * POST: 매체 연결 테스트 실행
 */
export const POST = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // pathname: /api/admin/clinics/[id]/api-configs/test
  const clinicsIdx = segments.indexOf('clinics')
  const idSegment = segments[clinicsIdx + 1]
  const clinicId = parseId(idSegment)
  if (!clinicId) return apiError('유효한 병원 ID가 필요합니다.')

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
    .from('clinic_api_configs')
    .select('config')
    .eq('clinic_id', clinicId)
    .eq('platform', platform)
    .maybeSingle()

  if (fetchError) {
    logger.error('설정 조회 실패', fetchError, { clinicId, platform })
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
    logger.error('설정 복호화 실패', new Error('decryptApiConfig returned null'), { clinicId, platform })
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
      case 'kakao_ads':
      case 'dable_ads':
        result = { success: false, error: '연결 테스트가 아직 지원되지 않습니다. API 키만 저장됩니다.', platform }
        break
      default:
        return apiError('지원하지 않는 플랫폼입니다.')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('연결 테스트 예외', error, { clinicId, platform })
    result = { success: false, error: message, platform }
  }

  // 테스트 결과 DB 업데이트
  try {
    await supabase
      .from('clinic_api_configs')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_result: result.success ? 'success' : 'failed',
      })
      .eq('clinic_id', clinicId)
      .eq('platform', platform)
  } catch (updateError) {
    logger.warn('테스트 결과 DB 업데이트 실패', { clinicId, platform, error: updateError })
  }

  if (result.success) {
    logger.info('연결 테스트 성공', { clinicId, platform, accountName: result.accountName })
    return apiSuccess({ success: true, accountName: result.accountName, platform })
  }

  logger.warn('연결 테스트 실패', { clinicId, platform, error: result.error })
  return apiSuccess({ success: false, error: result.error, platform })
})
