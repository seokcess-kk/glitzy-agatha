import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'MetaAds'
const logger = createLogger(SERVICE_NAME)

export interface MetaAdsOptions {
  clientId?: number
  accountId?: string
  accessToken?: string
}

export async function fetchMetaAds(date = new Date(), options?: MetaAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  // options 제공 시 options 사용, 아닐 시 환경변수 폴백
  const accountId = options?.accountId || process.env.META_AD_ACCOUNT_ID
  const accessToken = options?.accessToken || process.env.META_ACCESS_TOKEN
  if (!accountId || !accessToken) {
    logger.warn('Missing META_AD_ACCOUNT_ID or META_ACCESS_TOKEN', { clientId: options?.clientId })
    return { platform: 'meta_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // access_token은 URL이 아닌 Authorization 헤더로 전달 (보안)
    const url = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
      new URLSearchParams({
        level: 'campaign',
        fields: 'campaign_id,campaign_name,spend,clicks,impressions',
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        time_increment: '1',
      })

    const { response } = await fetchWithRetry(url, {
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(`Meta API error: ${JSON.stringify(err)}`)
    }

    const json = await response.json()
    const campaigns = json.data || []

    // 배치 처리
    if (campaigns.length > 0) {
      const rows = campaigns.map((c: Record<string, string>) => ({
        platform: 'meta_ads',
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        spend_amount: parseFloat(c.spend || '0'),
        clicks: parseInt(c.clicks || '0'),
        impressions: parseInt(c.impressions || '0'),
        stat_date: dateStr,
        client_id: options?.clientId || null,
      }))

      // client_id가 NULL이면 partial unique index 사용 (폴백 모드)
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

    return { platform: 'meta_ads', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, { action: 'sync', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'meta_ads', count: 0, error: message }
  }
}

// url_tags 문자열에서 utm_content 추출
function parseUtmContentFromUrlTags(urlTags: string | null | undefined): string | null {
  if (!urlTags) return null
  try {
    return new URLSearchParams(urlTags).get('utm_content') || null
  } catch {
    return null
  }
}

// 전체 URL에서 utm_content 쿼리 파라미터 추출
function parseUtmContentFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('utm_content') || null
  } catch {
    return null
  }
}

interface MetaAdInsight {
  ad_id: string
  ad_name: string
  campaign_id: string
  campaign_name: string
  spend: string
  clicks: string
  impressions: string
}

/**
 * Meta 광고(ad) 레벨 일별 성과 수집
 * - insights?level=ad 로 ad별 spend/clicks/impressions 조회
 * - 각 ad의 creative url_tags/effective_link에서 utm_content 추출
 * - ad_stats 테이블에 upsert
 */
export async function fetchMetaAdStats(date = new Date(), options?: MetaAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const accountId = options?.accountId || process.env.META_AD_ACCOUNT_ID
  const accessToken = options?.accessToken || process.env.META_ACCESS_TOKEN
  if (!accountId || !accessToken) {
    return { platform: 'meta_ads', count: 0, error: 'Missing credentials' }
  }

  const supabase = serverSupabase()

  try {
    // 1. Ad 레벨 인사이트 조회 (페이지네이션)
    const allAds: MetaAdInsight[] = []
    let nextUrl: string | null = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
      new URLSearchParams({
        level: 'ad',
        fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,clicks,impressions',
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        time_increment: '1',
        limit: '500',
      })

    while (nextUrl) {
      const { response } = await fetchWithRetry(nextUrl, {
        service: SERVICE_NAME,
        timeout: 30000,
        retries: 3,
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(`Meta API error (ad level): ${JSON.stringify(err)}`)
      }

      const json = await response.json()
      allAds.push(...(json.data || []))
      nextUrl = json.paging?.next || null
    }

    if (allAds.length === 0) {
      return { platform: 'meta_ads', count: 0 }
    }

    // 2. utm_content 매핑 — 기존 캐시 로드 후 새 ad_id만 Meta API 조회
    const adIds = [...new Set(allAds.map(a => a.ad_id))]

    // DB에서 기존 ad_id→utm_content 캐시
    const utmCache = new Map<string, string | null>()
    const { data: existingRows } = await supabase
      .from('ad_stats')
      .select('ad_id, utm_content')
      .in('ad_id', adIds)
      .not('utm_content', 'is', null)

    for (const row of existingRows || []) {
      utmCache.set(row.ad_id, row.utm_content)
    }

    // 캐시에 없는 ad_id → utm_content 추출 (url_tags → effective_link 순서)
    const uncachedIds = adIds.filter(id => !utmCache.has(id))
    for (const adId of uncachedIds) {
      try {
        const creativeUrl = `https://graph.facebook.com/v19.0/${adId}?fields=creative{url_tags,effective_link}`
        const { response: cRes } = await fetchWithRetry(creativeUrl, {
          service: SERVICE_NAME,
          timeout: 10000,
          retries: 2,
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        if (cRes.ok) {
          const cJson = await cRes.json()
          // 1차: url_tags에서 추출
          const urlTags = cJson?.creative?.url_tags as string | undefined
          let utm = parseUtmContentFromUrlTags(urlTags)
          // 2차: effective_link URL에서 추출
          if (!utm) {
            const effectiveLink = cJson?.creative?.effective_link as string | undefined
            utm = parseUtmContentFromUrl(effectiveLink)
          }
          utmCache.set(adId, utm)
        } else {
          utmCache.set(adId, null)
        }
      } catch {
        utmCache.set(adId, null)
      }
    }

    // 3. ad_stats upsert
    const rows = allAds.map(a => ({
      platform: 'meta_ads',
      ad_id: a.ad_id,
      ad_name: a.ad_name,
      campaign_id: a.campaign_id,
      campaign_name: a.campaign_name,
      utm_content: utmCache.get(a.ad_id) || null,
      spend_amount: parseFloat(a.spend || '0'),
      clicks: parseInt(a.clicks || '0'),
      impressions: parseInt(a.impressions || '0'),
      stat_date: dateStr,
      client_id: options?.clientId || null,
    }))

    const onConflict = options?.clientId
      ? 'client_id,platform,ad_id,stat_date'
      : 'platform,ad_id,stat_date'
    const { error } = await supabase
      .from('ad_stats')
      .upsert(rows, { onConflict })

    if (error) {
      logger.error('ad_stats upsert error', error, { clientId: options?.clientId })
    }

    const duration = Date.now() - startTime
    logger.info('Ad-level sync completed', {
      action: 'sync_ad_level',
      count: allAds.length,
      newUtmMappings: uncachedIds.length,
      duration,
      clientId: options?.clientId,
    })

    return { platform: 'meta_ads', count: allAds.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad-level sync failed', error, { action: 'sync_ad_level', duration: Date.now() - startTime, clientId: options?.clientId })
    return { platform: 'meta_ads', count: 0, error: message }
  }
}
