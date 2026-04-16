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
}

export async function fetchGoogleAds(date = new Date(), options?: GoogleAdsOptions) {
  const dateStr = getKstDateString(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }
  const startTime = Date.now()

  // options 제공 시 options 사용, 아닐 시 환경변수 폴백
  const oauthClientId = options?.oauthClientId || process.env.GOOGLE_ADS_CLIENT_ID
  const oauthClientSecret = options?.oauthClientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET
  const developerToken = options?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = options?.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID
  const refreshToken = options?.refreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN

  if (!oauthClientId || !oauthClientSecret || !developerToken || !customerId || !refreshToken) {
    logger.warn('Missing Google Ads credentials', { clientId: options?.clientId })
    return { platform: 'google_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    const client = new GoogleAdsApi({
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      developer_token: developerToken,
    })

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    })

    const campaigns = await customer.query(`
      SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions
      FROM campaign
      WHERE segments.date = '${dateStr}' AND campaign.status = 'ENABLED'
    `)

    // 배치 처리
    if (campaigns.length > 0) {
      const rows = campaigns.map((row) => ({
        platform: 'google_ads',
        campaign_id: String(row.campaign?.id || ''),
        campaign_name: row.campaign?.name || '',
        spend_amount: (row.metrics?.cost_micros || 0) / 1_000_000,
        clicks: row.metrics?.clicks || 0,
        impressions: row.metrics?.impressions || 0,
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
        logger.error('DB upsert error', error, { clientId: options?.clientId })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', { action: 'sync', count: campaigns.length, duration, clientId: options?.clientId })

    return { platform: 'google_ads', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'google_ads', count: 0, error: message }
  }
}
