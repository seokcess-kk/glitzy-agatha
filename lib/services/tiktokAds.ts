import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'
import { encryptApiConfig, decryptApiConfig } from '@/lib/crypto'

const SERVICE_NAME = 'TikTokAds'
const logger = createLogger(SERVICE_NAME)
const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/'

const TIKTOK_REFRESH_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/'

interface TikTokReportRow {
  dimensions: Record<string, string>
  metrics: Record<string, string>
}

export interface TikTokAdsOptions {
  clientId?: number
  advertiserId?: string
  accessToken?: string
}

/**
 * TikTok Report API 페이지네이션 공통 헬퍼
 * data_level/dimensions/metrics만 다르고 호출 구조는 동일
 */
async function fetchTikTokReport(params: {
  advertiserId: string
  accessToken: string
  dataLevel: string
  dimensions: string[]
  metrics: string[]
  dateStr: string
}): Promise<TikTokReportRow[]> {
  const allRows: TikTokReportRow[] = []
  let page = 1
  const pageSize = 200

  while (true) {
    const url = new URL(BASE_URL)
    url.searchParams.set('advertiser_id', params.advertiserId)
    url.searchParams.set('report_type', 'BASIC')
    url.searchParams.set('data_level', params.dataLevel)
    url.searchParams.set('dimensions', JSON.stringify(params.dimensions))
    url.searchParams.set('metrics', JSON.stringify(params.metrics))
    url.searchParams.set('start_date', params.dateStr)
    url.searchParams.set('end_date', params.dateStr)
    url.searchParams.set('page', String(page))
    url.searchParams.set('page_size', String(pageSize))

    const { response } = await fetchWithRetry(url.toString(), {
      headers: { 'Access-Token': params.accessToken },
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
    })

    if (!response.ok) {
      throw new Error(`TikTok API error (${params.dataLevel}): ${response.statusText}`)
    }

    const json = await response.json()
    if (json.code !== 0) {
      throw new Error(`TikTok API error: ${json.message || 'Unknown'}`)
    }

    allRows.push(...(json.data?.list || []))

    const totalPage = json.data?.page_info?.total_page || 1
    if (page >= totalPage) break
    page++
  }

  return allRows
}

/**
 * TikTok access_token 자동 갱신
 * - client_api_configs에서 refresh_token 확인
 * - token_obtained_at이 23시간 이상이면 갱신
 * - 갱신 성공 시 DB 업데이트 후 새 access_token 반환
 */
async function refreshTikTokTokenIfNeeded(
  clientId: number,
  currentToken: string
): Promise<string> {
  const appId = process.env.TIKTOK_APP_ID
  const appSecret = process.env.TIKTOK_APP_SECRET
  if (!appId || !appSecret) return currentToken

  const supabase = serverSupabase()

  const { data: configRow } = await supabase
    .from('client_api_configs')
    .select('config')
    .eq('client_id', clientId)
    .eq('platform', 'tiktok_ads')
    .eq('is_active', true)
    .maybeSingle()

  if (!configRow?.config) return currentToken

  const rawConfig = configRow.config
  const config = typeof rawConfig === 'object' && rawConfig !== null
    ? rawConfig as Record<string, unknown>
    : decryptApiConfig(rawConfig as string)

  if (!config) return currentToken

  const refreshToken = config.refresh_token as string | undefined
  const tokenObtainedAt = config.token_obtained_at as string | undefined

  if (!refreshToken || !tokenObtainedAt) return currentToken

  // 23시간 이상 경과했으면 갱신 (24시간 만료 전 1시간 여유)
  const elapsed = Date.now() - new Date(tokenObtainedAt).getTime()
  const TWENTY_THREE_HOURS = 23 * 60 * 60 * 1000

  if (elapsed < TWENTY_THREE_HOURS) return currentToken

  logger.info('TikTok access_token 갱신 시도', { clientId })

  try {
    const response = await fetch(TIKTOK_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        refresh_token: refreshToken,
      }),
    })

    const data = await response.json()

    if (data.code !== 0 || !data.data?.access_token) {
      logger.error('TikTok 토큰 갱신 실패', new Error(data.message || 'Unknown'), { clientId })
      return currentToken
    }

    const newConfig = {
      ...config,
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token || refreshToken,
      token_obtained_at: new Date().toISOString(),
      refresh_token_expires_at: data.data.refresh_token_expires_in
        ? new Date(Date.now() + data.data.refresh_token_expires_in * 1000).toISOString()
        : config.refresh_token_expires_at,
    }

    const encryptionKey = process.env.API_ENCRYPTION_KEY
    const configValue = encryptionKey ? encryptApiConfig(newConfig) : newConfig

    await supabase
      .from('client_api_configs')
      .update({ config: configValue, updated_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .eq('platform', 'tiktok_ads')

    logger.info('TikTok access_token 갱신 완료', { clientId })
    return data.data.access_token as string
  } catch (error) {
    logger.error('TikTok 토큰 갱신 중 예외', error, { clientId })
    return currentToken
  }
}

/**
 * TikTok 캠페인 레벨 수집 → ad_campaign_stats
 */
export async function fetchTikTokAds(date = new Date(), options?: TikTokAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const advertiserId = options?.advertiserId || process.env.TIKTOK_ADVERTISER_ID
  let accessToken = options?.accessToken || process.env.TIKTOK_ACCESS_TOKEN
  if (!advertiserId || !accessToken) {
    logger.warn('Missing TIKTOK_ADVERTISER_ID or TIKTOK_ACCESS_TOKEN', { clientId: options?.clientId })
    return { platform: 'tiktok_ads', count: 0, error: 'Missing credentials' }
  }

  // OAuth2 모드: clientId가 있으면 토큰 자동 갱신 시도
  if (options?.clientId) {
    accessToken = await refreshTikTokTokenIfNeeded(options.clientId, accessToken)
  }

  const supabase = serverSupabase()

  try {
    const rows = await fetchTikTokReport({
      advertiserId,
      accessToken,
      dataLevel: 'AUCTION_CAMPAIGN',
      dimensions: ['campaign_id', 'stat_time_day'],
      metrics: ['campaign_name', 'spend', 'clicks', 'impressions'],
      dateStr,
    })

    if (rows.length > 0) {
      const dbRows = rows.map((r) => ({
        platform: 'tiktok_ads',
        campaign_id: r.dimensions.campaign_id,
        campaign_name: r.metrics.campaign_name,
        spend_amount: parseFloat(r.metrics.spend || '0'),
        clicks: parseInt(r.metrics.clicks || '0'),
        impressions: parseInt(r.metrics.impressions || '0'),
        stat_date: dateStr,
        client_id: options?.clientId || null,
      }))

      const onConflict = options?.clientId
        ? 'client_id,platform,campaign_id,stat_date'
        : 'platform,campaign_id,stat_date'
      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(dbRows, { onConflict })

      if (error) {
        logger.error('DB upsert error', error, { clientId: options?.clientId })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', { action: 'sync', count: rows.length, duration, clientId: options?.clientId })

    return { platform: 'tiktok_ads', count: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'tiktok_ads', count: 0, error: message }
  }
}

/**
 * TikTok Ad 레벨 성과 수집 (소재별 성과용) → ad_stats
 */
export async function fetchTikTokAdStats(date = new Date(), options?: TikTokAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const advertiserId = options?.advertiserId || process.env.TIKTOK_ADVERTISER_ID
  const accessToken = options?.accessToken || process.env.TIKTOK_ACCESS_TOKEN
  if (!advertiserId || !accessToken) {
    logger.warn('Missing TikTok credentials for ad stats', { clientId: options?.clientId })
    return { platform: 'tiktok_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const rows = await fetchTikTokReport({
      advertiserId,
      accessToken,
      dataLevel: 'AUCTION_AD',
      dimensions: ['ad_id', 'stat_time_day'],
      metrics: ['ad_name', 'campaign_id', 'campaign_name', 'spend', 'clicks', 'impressions'],
      dateStr,
    })

    if (rows.length === 0) {
      return { platform: 'tiktok_ads', count: 0 }
    }

    const dbRows = rows.map((r) => ({
      platform: 'tiktok_ads',
      ad_id: r.dimensions.ad_id,
      ad_name: r.metrics.ad_name,
      campaign_id: r.metrics.campaign_id,
      spend_amount: parseFloat(r.metrics.spend || '0'),
      clicks: parseInt(r.metrics.clicks || '0'),
      impressions: parseInt(r.metrics.impressions || '0'),
      stat_date: dateStr,
      client_id: options?.clientId || null,
      utm_content: null,
    }))

    const onConflict = options?.clientId
      ? 'client_id,platform,ad_id,stat_date'
      : 'platform,ad_id,stat_date'
    const { error } = await supabase
      .from('ad_stats')
      .upsert(dbRows, { onConflict })

    if (error) {
      logger.error('ad_stats upsert error', error, { clientId: options?.clientId })
    }

    const duration = Date.now() - startTime
    logger.info('Ad stats sync completed', { action: 'ad_sync', count: rows.length, duration, clientId: options?.clientId })

    return { platform: 'tiktok_ads', count: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad stats sync failed', error, { action: 'ad_sync', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'tiktok_ads', count: 0, error: message }
  }
}
