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
 * Naver POST 헬퍼 (시그니처 헤더 + JSON body)
 */
async function naverPost<T>(
  uri: string,
  body: Record<string, unknown>,
  auth: { customerId: string; accessLicense: string; secretKey: string },
): Promise<T> {
  const headers = buildNaverHeaders('POST', uri, auth)
  const url = `${BASE_URL}${uri}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const text = await response.text().catch(() => '')

  if (!response.ok) {
    throw new Error(`Naver API error (${response.status}) at POST ${uri}: ${text}`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Naver API invalid JSON at POST ${uri}: ${text.slice(0, 200)}`)
  }
}

interface FetchNaverStatsOptions {
  debugLabel?: string
  /**
   * - 'single-id': 기존 광고 호출 방식. ID 마다 `?id={id}` 직렬에 가까운 청크(5개) 호출
   * - 'multi-value': 캠페인 호출 방식. 청크 단위로 multi-value `?ids=a&ids=b...` 호출
   * default: 'single-id'
   */
  idsMode?: 'single-id' | 'multi-value'
  /** multi-value 모드에서만 사용. 캠페인 호출 시 'CAMPAIGN' 명시 */
  statType?: 'CAMPAIGN' | 'ADGROUP' | 'AD'
}

/**
 * stats 엔드포인트 호출 (캠페인/광고 공용)
 *
 * 광고(ad) 레벨은 `?id={nccAdId}` 단일 호출이 운영 환경에서 통하던 방식이므로
 * 기본값(`'single-id'`)으로 유지. 캠페인 레벨은 다음 진단 결과를 반영해 multi-value + statType 사용:
 *
 *   - single-id `?id=cmp-...`           → 400 "잘못된 파라미터 형식"
 *   - multi-value `?ids=a&ids=b` (단독)  → 400 "잘못된 파라미터 형식"
 *   - json-array `?ids=["a","b"]`        → 400 "유효하지 않은 ID 형식"
 *   - json-array + statType=CAMPAIGN     → 400 Spring generic Bad Request
 *
 * 마지막 미시도 조합: **multi-value + statType=CAMPAIGN** — 기존 multi-value 가 statType 누락
 * 때문에 거부된 것이라는 가설 검증. ref. https://github.com/naver/searchad-apidoc/issues/976
 *
 * - single-id: 청크 5개 병렬, ID 마다 `?id={id}&fields=...&timeRange=...`
 * - multi-value: 청크 100개, `?ids=a&ids=b&...&fields=...&timeRange=...[&statType=...]`
 *
 * @param ids 동일 종류의 ID 배열 (nccCampaignId 만 또는 nccAdId 만)
 */
async function fetchNaverStats(
  ids: string[],
  dateStr: string,
  auth: { customerId: string; accessLicense: string; secretKey: string },
  options?: FetchNaverStatsOptions,
): Promise<NaverStatRow[]> {
  if (ids.length === 0) return []

  const { debugLabel, idsMode = 'single-id', statType } = options ?? {}
  const allRows: NaverStatRow[] = []
  const uri = '/stats'
  // convCnt = 네이버 전환추적(NPLA/공통키 기반) 전환수. 광고주가 설정한 전환 이벤트
  // (예: "신규 서비스 신청 완료") 기준. 캠페인 레벨에서 ad_campaign_stats.conversions 로 저장.
  // (광고 레벨 ad_stats 에는 conversions 컬럼이 없어 저장되지 않음 — 1차 범위 밖)
  const fieldsJson = JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'convCnt'])
  const timeRangeJson = JSON.stringify({ since: dateStr, until: dateStr })

  // 첫 청크/첫 ID 응답 메타데이터만 디버그 로깅 (인증/URL 미노출)
  let debugLogged = false

  function logDebug(meta: { idPrefix: string; chunkSize: number; status: number; bodyPreview: string }) {
    if (!debugLabel || debugLogged) return
    debugLogged = true
    let errorCode: string | number | undefined
    try {
      const parsed = JSON.parse(meta.bodyPreview)
      if (parsed && typeof parsed === 'object' && 'code' in parsed) {
        errorCode = (parsed as { code: string | number }).code
      }
    } catch {
      // ignore — JSON 아닐 수 있음
    }
    logger.info(`[debug:${debugLabel}] /stats response`, {
      idsMode,
      statType: statType ?? '(none)',
      idPrefix: meta.idPrefix,
      chunkSize: meta.chunkSize,
      status: meta.status,
      errorCode,
      bodyPreview: meta.bodyPreview.slice(0, 500),
    })
  }

  if (idsMode === 'single-id') {
    // 기존 광고 호출 방식 — ID 마다 `?id={id}` 청크 5개 병렬
    const CHUNK_SIZE = 5
    const CHUNK_GAP_MS = 200

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE)

      const promises = chunk.map(async (id): Promise<NaverStatRow[]> => {
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

        logDebug({ idPrefix: id.split('-')[0] ?? '', chunkSize: 1, status: response.status, bodyPreview: text })

        if (!response.ok) {
          throw new Error(`Naver API error (${response.status}) at ${uri}?id=${id}: ${text}`)
        }

        let json: unknown
        try { json = JSON.parse(text) } catch { return [] }

        // 단일 ID 응답: { summary, data: [{ ...메트릭 }], ... } — id 보강 필요
        let rows: NaverStatRow[] = []
        if (Array.isArray(json)) {
          rows = (json as Record<string, unknown>[]).map(row => (
            ('id' in row ? row : { id, ...row }) as unknown as NaverStatRow
          ))
        } else if (json && typeof json === 'object') {
          const obj = json as Record<string, unknown>
          if ('data' in obj && Array.isArray(obj.data)) {
            rows = (obj.data as Record<string, unknown>[]).map(row => (
              ('id' in row ? row : { id, ...row }) as unknown as NaverStatRow
            ))
          } else if ('id' in obj) {
            rows = [obj as unknown as NaverStatRow]
          } else {
            rows = [{ id, ...obj } as unknown as NaverStatRow]
          }
        }
        return rows
      })

      const settled = await Promise.allSettled(promises)
      for (const r of settled) {
        if (r.status === 'fulfilled') allRows.push(...r.value)
        else logger.warn('Naver stats single-id 호출 실패', { error: String(r.reason) })
      }

      if (i + CHUNK_SIZE < ids.length) {
        await new Promise(resolve => setTimeout(resolve, CHUNK_GAP_MS))
      }
    }
    return allRows
  }

  // idsMode === 'multi-value' — 캠페인 호출 모드
  const CHUNK_SIZE = 100
  const CHUNK_GAP_MS = 200

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)

    const params = new URLSearchParams()
    for (const id of chunk) {
      params.append('ids', id)
    }
    params.set('fields', fieldsJson)
    params.set('timeRange', timeRangeJson)
    if (statType) params.set('statType', statType)

    const headers = buildNaverHeaders('GET', uri, auth)
    const url = `${BASE_URL}${uri}?${params.toString()}`

    let status = 0
    let text = ''
    try {
      const { response } = await fetchWithRetry(url, {
        service: SERVICE_NAME,
        timeout: 30000,
        retries: 1,
        headers,
      })
      status = response.status
      text = await response.text().catch(() => '')
    } catch (err) {
      logger.warn('Naver stats multi-value 호출 실패', {
        error: String(err),
        chunkSize: chunk.length,
      })
      continue
    }

    logDebug({ idPrefix: chunk[0]?.split('-')[0] ?? '', chunkSize: chunk.length, status, bodyPreview: text })

    if (status < 200 || status >= 300) {
      logger.warn('Naver stats multi-value non-2xx', { status, chunkSize: chunk.length, statType: statType ?? null })
      continue
    }

    // 방어적 파싱: 배열 / { data: [...] } / 단일 객체 모두 대응
    let json: unknown
    try { json = JSON.parse(text) } catch { continue }

    let rows: NaverStatRow[] = []
    if (Array.isArray(json)) {
      rows = json as NaverStatRow[]
    } else if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>
      if ('data' in obj && Array.isArray(obj.data)) {
        rows = obj.data as NaverStatRow[]
      } else if ('id' in obj) {
        rows = [obj as unknown as NaverStatRow]
      }
    }
    allRows.push(...rows)

    if (i + CHUNK_SIZE < ids.length) {
      await new Promise(resolve => setTimeout(resolve, CHUNK_GAP_MS))
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
 * /stat-reports 비동기 보고서 API — PoC (1차)
 *
 * 공식 sample (PHP/Java) 기반 정공법.
 *   1. POST /stat-reports         body: { reportTp, statDt: YYYYMMDD }
 *   2. GET /stat-reports/{jobId}  상태 폴링 (REGIST/RUNNING/WAITING/AGGREGATING → BUILT)
 *   3. response.downloadUrl       TSV 다운로드 (네이버가 fileVersion 파라미터 포함 URL 발급)
 *
 * 1차 PoC 범위: 다운로드까지만. TSV 헤더와 첫 2줄을 디버그 로그로 노출.
 * 컬럼 매핑 + ad_campaign_stats upsert 는 결과 확인 후 2차에서.
 */
interface NaverStatReportJob {
  reportJobId: number
  status: 'REGIST' | 'RUNNING' | 'WAITING' | 'AGGREGATING' | 'BUILT' | 'DOWNLOADED' | 'ERROR' | 'NONE'
  downloadUrl?: string
  reportTp?: string
  statDt?: string
}

async function fetchNaverStatReport(
  reportTp: 'AD' | 'AD_DETAIL' | 'AD_CONVERSION' | 'AD_CONVERSION_DETAIL',
  statDt: string, // YYYYMMDD
  auth: { customerId: string; accessLicense: string; secretKey: string },
  debugLabel?: string,
): Promise<{ headers: string[]; firstRows: string[][]; totalRows: number } | null> {
  // 1. POST /stat-reports — 보고서 생성 요청
  const created = await naverPost<NaverStatReportJob>('/stat-reports', { reportTp, statDt }, auth)
  if (debugLabel) {
    logger.info(`[debug:${debugLabel}] stat-report created`, {
      reportTp,
      statDt,
      reportJobId: created.reportJobId,
      status: created.status,
    })
  }
  if (created.status === 'ERROR' || created.status === 'NONE') {
    logger.warn('stat-report 생성 직후 종료 상태', { reportTp, statDt, status: created.status })
    return null
  }

  // 2. 폴링 (최대 ~60초). PHP sample 은 5초 간격.
  const POLL_MAX_TRIES = 24
  const POLL_INTERVAL_MS = 2500
  let job: NaverStatReportJob = created
  for (let tries = 0; tries < POLL_MAX_TRIES; tries++) {
    if (job.status === 'BUILT' || job.status === 'DOWNLOADED') break
    if (job.status === 'ERROR' || job.status === 'NONE') {
      logger.warn('stat-report 종료 상태', { reportTp, statDt, status: job.status })
      return null
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    job = await naverGet<NaverStatReportJob>(`/stat-reports/${created.reportJobId}`, undefined, auth)
  }

  if (job.status !== 'BUILT' && job.status !== 'DOWNLOADED') {
    logger.warn('stat-report 폴링 timeout', { reportTp, statDt, status: job.status, jobId: created.reportJobId })
    return null
  }
  if (!job.downloadUrl) {
    logger.warn('stat-report BUILT 인데 downloadUrl 누락', { reportTp, statDt, jobId: created.reportJobId })
    return null
  }

  // 3. downloadUrl 호출 — 공식 PHP sample 기준 시그니처 헤더가 필요하다.
  //    signature 계산 시 path 는 '/report-download' (querystring 제외).
  //    네이버가 발급한 downloadUrl 에는 fileVersion 등 query param 이 포함돼 있어 그대로 사용.
  const downloadUrlObj = new URL(job.downloadUrl)
  const downloadPath = downloadUrlObj.pathname || '/report-download'
  const downloadHeaders = buildNaverHeaders('GET', downloadPath, auth)

  const downloadResponse = await fetch(job.downloadUrl, { headers: downloadHeaders })
  if (!downloadResponse.ok) {
    const errBody = await downloadResponse.text().catch(() => '')
    logger.warn('stat-report 다운로드 실패', {
      reportTp,
      statDt,
      status: downloadResponse.status,
      downloadPath,
      bodyPreview: errBody.slice(0, 500),
    })
    return null
  }
  const tsv = await downloadResponse.text()

  // 4. TSV 파싱 — 첫 줄을 헤더로 가정. 일부 보고서는 헤더 없을 수 있어 PoC 단계에서 확인.
  const lines = tsv.split(/\r?\n/).filter(line => line.length > 0)
  if (lines.length === 0) {
    logger.info('stat-report 결과 0건', { reportTp, statDt })
    return { headers: [], firstRows: [], totalRows: 0 }
  }

  const headers = lines[0].split('\t')
  const dataLines = lines.slice(1)
  const firstRows = dataLines.slice(0, 2).map(line => line.split('\t'))

  if (debugLabel) {
    logger.info(`[debug:${debugLabel}] stat-report TSV preview`, {
      reportTp,
      statDt,
      jobId: created.reportJobId,
      totalLines: lines.length,
      headerCount: headers.length,
      headers, // 1차 PoC: 컬럼명 전체 노출
      sampleRow1: firstRows[0] ?? null,
      sampleRow2: firstRows[1] ?? null,
    })
  }

  return { headers, firstRows, totalRows: dataLines.length }
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

    // 임시 디버그: 캠페인 목록 첫 1건 raw 형태 (id 접두사 형식 확인용)
    logger.info('[debug:campaign] /ncc/campaigns 첫 1건', {
      clientId: options?.clientId,
      count: campaigns.length,
      sample: campaigns[0],
    })

    // 2. 통계 조회 — /stat-reports PoC (1차).
    //    /stats 5가지 호출 조합 모두 400 거부 확인 후 정공법으로 전환.
    //    PoC 단계: AD 리포트 TSV 헤더와 첫 2줄을 디버그 로그로 노출. 컬럼 매핑/upsert 는
    //    결과 확인 후 2차 PR 에서 진행. statRows 는 빈 배열로 두어 메타데이터만 저장.
    const statDt = dateStr.replace(/-/g, '') // YYYY-MM-DD → YYYYMMDD
    try {
      await fetchNaverStatReport('AD', statDt, auth, 'campaign-report')
    } catch (err) {
      logger.warn('stat-report PoC 호출 실패', { error: String(err), statDt })
    }
    const statRows: NaverStatRow[] = []

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

    // stats 전부 실패 케이스: 캠페인 메타는 받았는데 통계 0건
    //  → backfill/cron 결과에 error 를 실어 호출자(상위)가 실패로 인지하게 한다.
    //    (이전엔 count=campaigns.length 만 반환해 성공으로 위장되던 문제 보정)
    const statsAllFailed = statRows.length === 0
    if (statsAllFailed) {
      logger.warn('Naver 캠페인 stats 전부 실패 (메타데이터만 저장)', {
        clientId: options?.clientId,
        campaignCount: campaigns.length,
        duration,
      })
      return {
        platform: 'naver_ads',
        count: campaigns.length,
        error: `Campaign stats failed (0/${campaigns.length}). 메타데이터만 저장됨. /stats 응답 거부.`,
      }
    }

    logger.info('Sync completed', {
      action: 'sync',
      count: campaigns.length,
      statsMatched: statRows.length,
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
