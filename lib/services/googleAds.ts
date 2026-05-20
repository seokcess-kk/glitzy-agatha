import { GoogleAdsApi } from 'google-ads-api'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'GoogleAds'
const logger = createLogger(SERVICE_NAME)

export interface GoogleAdsOptions {
  clientId?: number
  oauthClientId?: string
  oauthClientSecret?: string
  developerToken?: string
  customerId?: string
  refreshToken?: string
  loginCustomerId?: string
}

// google-ads-api 가 advertising_channel_type 을 number(enum) 로 반환하는 케이스 대응
const CHANNEL_TYPE_NUM_TO_STR: Record<number, string> = {
  2: 'SEARCH', 3: 'DISPLAY', 4: 'SHOPPING', 5: 'HOTEL', 6: 'VIDEO',
  7: 'MULTI_CHANNEL', 8: 'LOCAL', 9: 'SMART', 10: 'PERFORMANCE_MAX',
  11: 'LOCAL_SERVICES', 13: 'TRAVEL', 14: 'DEMAND_GEN',
}

// Google Ads 채널 타입 → CAMPAIGN_TYPES_BY_PLATFORM.google_ads 매핑
const CHANNEL_TYPE_MAP: Record<string, string> = {
  SEARCH: 'search',
  DISPLAY: 'gdn',
  VIDEO: 'youtube',
  MULTI_CHANNEL: 'app',
  PERFORMANCE_MAX: 'pmax',
  DEMAND_GEN: 'demand_gen',
}

function mapChannelType(type: number | string | undefined | null): string | null {
  if (type === null || type === undefined) return null
  const key = typeof type === 'number'
    ? CHANNEL_TYPE_NUM_TO_STR[type]
    : String(type).toUpperCase()
  if (!key) return null
  return CHANNEL_TYPE_MAP[key] || null
}

function parseUtmContentFromFinalUrls(urls: string[] | undefined | null): string | null {
  if (!Array.isArray(urls) || urls.length === 0) return null
  for (const url of urls) {
    try {
      const u = new URL(url)
      const utm = u.searchParams.get('utm_content')
      if (utm) return utm
    } catch {
      // skip invalid URL
    }
  }
  return null
}

function buildCustomer(options?: GoogleAdsOptions) {
  const oauthClientId = options?.oauthClientId || process.env.GOOGLE_ADS_CLIENT_ID
  const oauthClientSecret = options?.oauthClientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET
  const developerToken = options?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = options?.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID
  const refreshToken = options?.refreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN
  const loginCustomerId = options?.loginCustomerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

  if (!oauthClientId || !oauthClientSecret || !developerToken || !customerId || !refreshToken) {
    return null
  }

  const normalizedCustomerId = customerId.replace(/-/g, '')
  const normalizedLoginCustomerId = loginCustomerId?.replace(/-/g, '')

  const client = new GoogleAdsApi({
    client_id: oauthClientId,
    client_secret: oauthClientSecret,
    developer_token: developerToken,
  })

  return client.Customer({
    customer_id: normalizedCustomerId,
    refresh_token: refreshToken,
    ...(normalizedLoginCustomerId ? { login_customer_id: normalizedLoginCustomerId } : {}),
  })
}

/**
 * Google Ads 캠페인 레벨 일별 성과 수집
 * - 모든 advertising_channel_type 포함 (Search, Display, Video, PMax, Demand Gen, App 등)
 * - campaign_type 컬럼에 매핑된 우리쪽 타입 코드 저장
 * - 매체 전환(conversions) + 전환 매출(conversions_value) 함께 저장
 */
export async function fetchGoogleAds(date = new Date(), options?: GoogleAdsOptions) {
  const dateStr = getKstDateString(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }
  const startTime = Date.now()

  const customer = buildCustomer(options)
  if (!customer) {
    logger.warn('Missing Google Ads credentials', { clientId: options?.clientId })
    return { platform: 'google_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.advertising_channel_type,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date = '${dateStr}' AND campaign.status = 'ENABLED'
    `)

    if (campaigns.length > 0) {
      const rows = campaigns.map((row) => ({
        platform: 'google_ads',
        campaign_id: String(row.campaign?.id || ''),
        campaign_name: row.campaign?.name || '',
        campaign_type: mapChannelType(row.campaign?.advertising_channel_type as number | string | undefined),
        spend_amount: (row.metrics?.cost_micros || 0) / 1_000_000,
        clicks: row.metrics?.clicks || 0,
        impressions: row.metrics?.impressions || 0,
        conversions: Math.round(row.metrics?.conversions || 0),
        revenue: row.metrics?.conversions_value || 0,
        stat_date: dateStr,
        client_id: options?.clientId || null,
      }))

      const onConflict = options?.clientId
        ? 'client_id,platform,campaign_id,stat_date'
        : 'platform,campaign_id,stat_date'
      const { error } = await supabase
        .from('ad_campaign_stats')
        .upsert(rows, { onConflict })

      if (error) {
        logger.error('Campaign DB upsert error', error, { clientId: options?.clientId })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Campaign sync completed', { action: 'sync_campaign', count: campaigns.length, duration, clientId: options?.clientId })

    return { platform: 'google_ads', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Campaign sync failed', error, { action: 'sync_campaign', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'google_ads', count: 0, error: message }
  }
}

/**
 * Google Ads 광고(ad) 레벨 일별 성과 수집
 * - ad_group_ad 리소스 쿼리 → 일반 캠페인의 소재별 성과
 * - final_urls 에서 utm_content 추출 → ad_stats 와 leads 매칭
 *
 * 참고: Performance Max 는 asset_group 기반이라 ad_group_ad 가 비어있어
 *       ad 레벨 데이터가 빠질 수 있음 (campaign 레벨로만 집계됨).
 */
export async function fetchGoogleAdStats(date = new Date(), options?: GoogleAdsOptions) {
  const dateStr = getKstDateString(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }
  const startTime = Date.now()

  const customer = buildCustomer(options)
  if (!customer) {
    return { platform: 'google_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const rows = await customer.query(`
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.final_urls,
        campaign.id,
        campaign.name,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions
      FROM ad_group_ad
      WHERE segments.date = '${dateStr}'
        AND ad_group_ad.status = 'ENABLED'
        AND campaign.status = 'ENABLED'
    `)

    if (rows.length === 0) {
      logger.info('No ad-level data', { clientId: options?.clientId })
      return { platform: 'google_ads', count: 0 }
    }

    const adRows = rows
      .map((row) => {
        const adIdRaw = row.ad_group_ad?.ad?.id
        const finalUrls = row.ad_group_ad?.ad?.final_urls as string[] | undefined
        return {
          platform: 'google_ads',
          ad_id: adIdRaw ? String(adIdRaw) : '',
          ad_name: row.ad_group_ad?.ad?.name || '',
          campaign_id: String(row.campaign?.id || ''),
          campaign_name: row.campaign?.name || '',
          utm_content: parseUtmContentFromFinalUrls(finalUrls),
          spend_amount: (row.metrics?.cost_micros || 0) / 1_000_000,
          clicks: row.metrics?.clicks || 0,
          impressions: row.metrics?.impressions || 0,
          conversions: Math.round(row.metrics?.conversions || 0),
          stat_date: dateStr,
          client_id: options?.clientId || null,
        }
      })
      .filter(r => r.ad_id)

    if (adRows.length === 0) {
      return { platform: 'google_ads', count: 0 }
    }

    const onConflict = options?.clientId
      ? 'client_id,platform,ad_id,stat_date'
      : 'platform,ad_id,stat_date'
    const { error } = await supabase
      .from('ad_stats')
      .upsert(adRows, { onConflict })

    if (error) {
      logger.error('Ad DB upsert error', error, { clientId: options?.clientId })
    }

    const duration = Date.now() - startTime
    logger.info('Ad-level sync completed', { action: 'sync_ad', count: adRows.length, duration, clientId: options?.clientId })

    return { platform: 'google_ads', count: adRows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad-level sync failed', error, { action: 'sync_ad', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'google_ads', count: 0, error: message }
  }
}
