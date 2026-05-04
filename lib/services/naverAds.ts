/**
 * Naver Search Ads (검색광고) 동기화 서비스
 *
 * - 인증: HMAC-SHA256 시그니처 기반 (X-Timestamp, X-API-KEY, X-Customer, X-Signature)
 * - 캠페인 레벨: GET /ncc/campaigns + GET /stats → ad_campaign_stats
 * - 광고(ad) 레벨: GET /ncc/adgroups → /ncc/ads + GET /stats → ad_stats
 * - Naver는 url 추적 별도이므로 utm_content는 빈 문자열로 저장
 */

import { createHmac } from 'crypto'
import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const SERVICE_NAME = 'NaverAds'
const logger = createLogger(SERVICE_NAME)
const BASE_URL = 'https://api.searchad.naver.com'

export interface NaverAdsOptions {
  clientId?: number
  customerId?: string
  accessLicense?: string
  secretKey?: string
}

interface NaverCampaign {
  nccCampaignId: string
  name: string
  campaignTp?: string
  customerId?: number | string
}

interface NaverAdGroup {
  nccAdgroupId: string
  name?: string
  nccCampaignId: string
}

interface NaverAd {
  nccAdId: string
  nccAdgroupId: string
  nccCampaignId?: string
  // ad.name이 별도로 없는 경우가 많아 광고그룹명/광고소재명을 폴백 사용
  ad?: { name?: string; headline?: string; description?: string; final_url?: string }
}

interface NaverStatRow {
  id: string
  // Naver는 fields 배열 순서대로 metric을 키로 반환
  impCnt?: number | string
  clkCnt?: number | string
  salesAmt?: number | string
  ctr?: number | string
  cpc?: number | string
  convCnt?: number | string
  ccnt?: number | string
}

interface NaverStatsResponse {
  data?: NaverStatRow[]
}

/**
 * HMAC-SHA256 시그니처 헤더 생성
 * signature = base64( HMAC-SHA256(secretKey, `${timestamp}.${method}.${uri}`) )
 *
 * uri는 path만 사용 (querystring 제외). method는 대문자.
 */
function buildNaverHeaders(
  method: string,
  uri: string,
  opts: { customerId: string; accessLicense: string; secretKey: string },
): Record<string, string> {
  const timestamp = String(Date.now())
  const message = `${timestamp}.${method.toUpperCase()}.${uri}`
  const signature = createHmac('sha256', opts.secretKey).update(message).digest('base64')

  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': opts.accessLicense,
    'X-Customer': opts.customerId,
    'X-Signature': signature,
  }
}

/**
 * Naver API 호출 헬퍼 (시그니처 헤더 자동 생성 + fetchWithRetry)
 *
 * @param uri path만 (예: '/ncc/campaigns'). 시그니처 계산용.
 * @param query querystring (선택). 실제 URL에만 추가되며 시그니처에는 미포함.
 */
async function naverGet<T>(
  uri: string,
  query: Record<string, string> | undefined,
  auth: { customerId: string; accessLicense: string; secretKey: string },
): Promise<T> {
  const headers = buildNaverHeaders('GET', uri, auth)
  const queryStr = query ? `?${new URLSearchParams(query).toString()}` : ''
  const url = `${BASE_URL}${uri}${queryStr}`

  const { response } = await fetchWithRetry(url, {
    service: SERVICE_NAME,
    timeout: 30000,
    retries: 3,
    headers,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    throw new Error(`Naver API error (${response.status}) at ${uri}: ${body}`)
  }

  return (await response.json()) as T
}

/**
 * stats 엔드포인트 호출 (캠페인/광고 공용)
 *
 * Naver Search Ads `/stats` 는 공식 Python SDK 기준 `id` 단일 호출이 가장 안정적이다.
 * (`ids` multi-value 또는 statType 명시 모두 환경에 따라 400 으로 거부됨).
 *
 * 따라서 ID 마다 한 번씩 GET `/stats?id={id}&fields={fields}&timeRange={timeRange}` 호출.
 * 동시에 너무 많이 보내지 않도록 10개씩 청크 병렬 처리하고, 일부 실패는 warn 로깅 후 진행.
 *
 * @param ids nccCampaignId 또는 nccAdId 배열
 * @param dateStr YYYY-MM-DD
 */
async function fetchNaverStats(
  ids: string[],
  dateStr: string,
  auth: { customerId: string; accessLicense: string; secretKey: string },
): Promise<NaverStatRow[]> {
  if (ids.length === 0) return []

  const allRows: NaverStatRow[] = []
  const uri = '/stats'
  const fieldsJson = JSON.stringify(['impCnt', 'clkCnt', 'salesAmt'])
  const timeRangeJson = JSON.stringify({ since: dateStr, until: dateStr })

  const CHUNK_SIZE = 10
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)

    const promises = chunk.map(async (id, idx): Promise<NaverStatRow[]> => {
      const params = new URLSearchParams()
      params.set('id', id)
      params.set('fields', fieldsJson)
      params.set('timeRange', timeRangeJson)

      const headers = buildNaverHeaders('GET', uri, auth)
      const url = `${BASE_URL}${uri}?${params.toString()}`

      const { response } = await fetchWithRetry(url, {
        service: SERVICE_NAME,
        timeout: 15000,
        retries: 1,
        headers,
      })

      const text = await response.text().catch(() => '')

      if (!response.ok) {
        throw new Error(`Naver API error (${response.status}) at ${uri}?id=${id}: ${text}`)
      }

      // [DEBUG] 첫 번째 청크의 첫 번째 ID 응답 raw 를 production 로그에 노출
      // (응답 형식 매핑 검증 완료 후 제거 예정)
      if (i === 0 && idx === 0) {
        logger.info('Naver /stats raw response (debug)', { id, body: text.slice(0, 800) })
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        return []
      }

      // 응답 형식: { id, impCnt, ... } 단일 객체 / [{...}] 배열 / { data: [...] } 모두 대응
      let rows: NaverStatRow[] = []
      if (Array.isArray(json)) {
        rows = json as NaverStatRow[]
      } else if (json && typeof json === 'object') {
        const obj = json as Record<string, unknown>
        if ('data' in obj && Array.isArray(obj.data)) {
          rows = obj.data as NaverStatRow[]
        } else if ('id' in obj) {
          rows = [obj as unknown as NaverStatRow]
        } else {
          // id 가 없는 객체는 메트릭만 있는 형태 → 호출 시 사용한 id 로 보강
          rows = [{ id, ...obj } as unknown as NaverStatRow]
        }
      }
      return rows
    })

    const settled = await Promise.allSettled(promises)
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        allRows.push(...r.value)
      } else {
        logger.warn('Naver stats 단일 ID 호출 실패', { error: String(r.reason) })
      }
    }
  }

  return allRows
}

function toInt(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isFinite(n) ? n : 0
}

function toFloat(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
}

/**
 * Naver 캠페인 레벨 일별 성과 수집 → ad_campaign_stats
 */
export async function fetchNaverAds(date = new Date(), options?: NaverAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const customerId = options?.customerId || process.env.NAVER_ADS_CUSTOMER_ID
  const accessLicense = options?.accessLicense || process.env.NAVER_ADS_ACCESS_LICENSE
  const secretKey = options?.secretKey || process.env.NAVER_ADS_SECRET_KEY

  if (!customerId || !accessLicense || !secretKey) {
    logger.warn('Missing NAVER_ADS_CUSTOMER_ID / NAVER_ADS_ACCESS_LICENSE / NAVER_ADS_SECRET_KEY', {
      clientId: options?.clientId,
    })
    return { platform: 'naver_ads', count: 0, error: 'Missing credentials' }
  }

  const auth = { customerId, accessLicense, secretKey }
  const supabase = serverSupabase()

  try {
    // 1. 캠페인 목록 조회
    const campaigns = await naverGet<NaverCampaign[]>('/ncc/campaigns', undefined, auth)
    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      logger.info('Naver 캠페인 없음', { clientId: options?.clientId })
      return { platform: 'naver_ads', count: 0 }
    }

    // 2. 통계 조회 (캠페인 ID 배열)
    const campaignIds = campaigns.map((c) => c.nccCampaignId)
    const statRows = await fetchNaverStats(campaignIds, dateStr, auth)

    // 캠페인 ID → 통계 매핑
    const statMap = new Map<string, NaverStatRow>()
    for (const row of statRows) {
      statMap.set(row.id, row)
    }

    // 3. 매핑 후 upsert
    const dbRows = campaigns.map((c) => {
      const stat = statMap.get(c.nccCampaignId)
      return {
        platform: 'naver_ads',
        campaign_id: c.nccCampaignId,
        campaign_name: c.name,
        campaign_type: c.campaignTp || null,
        spend_amount: toFloat(stat?.salesAmt),
        clicks: toInt(stat?.clkCnt),
        impressions: toInt(stat?.impCnt),
        conversions: toInt(stat?.convCnt),
        stat_date: dateStr,
        client_id: options?.clientId || null,
      }
    })

    const onConflict = options?.clientId
      ? 'client_id,platform,campaign_id,stat_date'
      : 'platform,campaign_id,stat_date'

    const { error } = await supabase.from('ad_campaign_stats').upsert(dbRows, { onConflict })

    if (error) {
      logger.error('DB upsert error', error, { clientId: options?.clientId })
    }

    const duration = Date.now() - startTime
    logger.info('Sync completed', {
      action: 'sync',
      count: campaigns.length,
      duration,
      clientId: options?.clientId,
    })

    return { platform: 'naver_ads', count: campaigns.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Sync failed', error, {
      action: 'sync',
      duration: Date.now() - startTime,
      clientId: options?.clientId,
    })
    return { platform: 'naver_ads', count: 0, error: message }
  }
}

/**
 * Naver 광고(ad) 레벨 일별 성과 수집 → ad_stats
 *
 * 1. 캠페인 목록 → 각 캠페인의 광고그룹 목록 → 각 광고그룹의 광고 목록 순회
 * 2. 모은 nccAdId 배열로 stats 호출 (청크 분할)
 * 3. ad_stats 테이블에 upsert. utm_content는 Naver가 별도 추적이라 빈 문자열로 저장.
 */
export async function fetchNaverAdStats(date = new Date(), options?: NaverAdsOptions) {
  const dateStr = getKstDateString(date)
  const startTime = Date.now()

  const customerId = options?.customerId || process.env.NAVER_ADS_CUSTOMER_ID
  const accessLicense = options?.accessLicense || process.env.NAVER_ADS_ACCESS_LICENSE
  const secretKey = options?.secretKey || process.env.NAVER_ADS_SECRET_KEY

  if (!customerId || !accessLicense || !secretKey) {
    logger.warn('Missing Naver credentials for ad stats', { clientId: options?.clientId })
    return { platform: 'naver_ads', count: 0, error: 'Missing credentials' }
  }

  const auth = { customerId, accessLicense, secretKey }
  const supabase = serverSupabase()

  try {
    // 1. 캠페인 목록
    const campaigns = await naverGet<NaverCampaign[]>('/ncc/campaigns', undefined, auth)
    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      return { platform: 'naver_ads', count: 0 }
    }

    const campaignNameMap = new Map<string, string>()
    for (const c of campaigns) campaignNameMap.set(c.nccCampaignId, c.name)

    // 2. 각 캠페인의 광고그룹 → 광고 순회
    interface AdMeta {
      nccAdId: string
      nccAdgroupId: string
      nccCampaignId: string
      adName: string
      campaignName: string
    }
    const allAds: AdMeta[] = []

    // 광고그룹명 매핑 (광고에 별도 name이 없을 때 폴백)
    for (const camp of campaigns) {
      const adGroups = await naverGet<NaverAdGroup[]>(
        '/ncc/adgroups',
        { nccCampaignId: camp.nccCampaignId },
        auth,
      ).catch((err) => {
        logger.warn('Naver adgroups 조회 실패', { campaignId: camp.nccCampaignId, error: String(err) })
        return [] as NaverAdGroup[]
      })

      if (!Array.isArray(adGroups) || adGroups.length === 0) continue

      const adGroupNameMap = new Map<string, string>()
      for (const g of adGroups) adGroupNameMap.set(g.nccAdgroupId, g.name || g.nccAdgroupId)

      for (const ag of adGroups) {
        const ads = await naverGet<NaverAd[]>(
          '/ncc/ads',
          { nccAdgroupId: ag.nccAdgroupId },
          auth,
        ).catch((err) => {
          logger.warn('Naver ads 조회 실패', { adgroupId: ag.nccAdgroupId, error: String(err) })
          return [] as NaverAd[]
        })

        if (!Array.isArray(ads)) continue

        for (const a of ads) {
          // 광고명: ad.headline > adgroup name > nccAdId 순서 폴백
          const adName =
            a.ad?.headline ||
            a.ad?.name ||
            adGroupNameMap.get(ag.nccAdgroupId) ||
            a.nccAdId
          allAds.push({
            nccAdId: a.nccAdId,
            nccAdgroupId: ag.nccAdgroupId,
            nccCampaignId: camp.nccCampaignId,
            adName,
            campaignName: camp.name,
          })
        }
      }
    }

    if (allAds.length === 0) {
      return { platform: 'naver_ads', count: 0 }
    }

    // 3. 광고 통계 조회
    const adIds = allAds.map((a) => a.nccAdId)
    const statRows = await fetchNaverStats(adIds, dateStr, auth)

    const statMap = new Map<string, NaverStatRow>()
    for (const row of statRows) statMap.set(row.id, row)

    // 4. ad_stats upsert (utm_content는 빈 문자열 — Naver는 url 추적 별도)
    const dbRows = allAds.map((a) => {
      const stat = statMap.get(a.nccAdId)
      return {
        platform: 'naver_ads',
        ad_id: a.nccAdId,
        ad_name: a.adName,
        campaign_id: a.nccCampaignId,
        campaign_name: a.campaignName,
        utm_content: '',
        spend_amount: toFloat(stat?.salesAmt),
        clicks: toInt(stat?.clkCnt),
        impressions: toInt(stat?.impCnt),
        stat_date: dateStr,
        client_id: options?.clientId || null,
      }
    })

    const onConflict = options?.clientId
      ? 'client_id,platform,ad_id,stat_date'
      : 'platform,ad_id,stat_date'

    const { error } = await supabase.from('ad_stats').upsert(dbRows, { onConflict })

    if (error) {
      logger.error('ad_stats upsert error', error, { clientId: options?.clientId })
    }

    const duration = Date.now() - startTime
    logger.info('Ad-level sync completed', {
      action: 'sync_ad_level',
      count: allAds.length,
      duration,
      clientId: options?.clientId,
    })

    return { platform: 'naver_ads', count: allAds.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Ad-level sync failed', error, {
      action: 'sync_ad_level',
      duration: Date.now() - startTime,
      clientId: options?.clientId,
    })
    return { platform: 'naver_ads', count: 0, error: message }
  }
}
