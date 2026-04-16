/**
 * 병원별 광고 동기화 오케스트레이터
 * - clinic_api_configs에서 활성 설정을 조회하여 병원별로 동기화
 * - 설정이 없는 경우 환경변수 폴백 (기존 방식)
 */

import { serverSupabase } from '@/lib/supabase'
import { decryptApiConfig } from '@/lib/crypto'
import { createLogger } from '@/lib/logger'
import { fetchMetaAds, fetchMetaAdStats } from '@/lib/services/metaAds'
import { fetchGoogleAds } from '@/lib/services/googleAds'
import { fetchTikTokAds, fetchTikTokAdStats } from '@/lib/services/tiktokAds'
import { type ApiPlatform, SYNC_ENABLED_PLATFORMS, API_PLATFORM_LABELS } from '@/lib/platform'

const logger = createLogger('AdSyncManager')

export interface SyncResult {
  clinicId: number | null  // null = 환경변수 폴백
  clinicName: string
  platform: string
  count: number
  error?: string
}

interface ClinicApiConfig {
  id: number
  clinic_id: number
  platform: string
  config: string
  is_active: boolean
  clinics?: { name: string } | null
}

/**
 * 단일 병원의 단일 매체 동기화
 */
async function syncPlatform(
  clinicId: number,
  clinicName: string,
  platform: ApiPlatform,
  configData: string | Record<string, unknown>,
  date: Date,
): Promise<SyncResult> {
  // JSONB에서 꺼낸 값이 객체(평문)이면 직접 사용, 문자열(암호화)이면 복호화
  const decrypted = typeof configData === 'object' && configData !== null
    ? configData
    : decryptApiConfig(configData)
  if (!decrypted) {
    logger.error('설정 복호화 실패', new Error('decryptApiConfig returned null'), {
      clinicId,
      platform,
    })
    return {
      clinicId,
      clinicName,
      platform: API_PLATFORM_LABELS[platform],
      count: 0,
      error: 'Config decryption failed',
    }
  }

  try {
    switch (platform) {
      case 'meta_ads': {
        const metaOpts = {
          clinicId,
          accountId: decrypted.account_id as string,
          accessToken: decrypted.access_token as string,
        }
        const [campaignResult, adResult] = await Promise.all([
          fetchMetaAds(date, metaOpts),
          fetchMetaAdStats(date, metaOpts),
        ])
        return {
          clinicId,
          clinicName,
          platform: campaignResult.platform,
          count: campaignResult.count + adResult.count,
          error: campaignResult.error || adResult.error || undefined,
        }
      }
      case 'google_ads': {
        const result = await fetchGoogleAds(date, {
          clinicId,
          clientId: decrypted.client_id as string,
          clientSecret: decrypted.client_secret as string,
          developerToken: decrypted.developer_token as string,
          customerId: decrypted.customer_id as string,
          refreshToken: decrypted.refresh_token as string,
        })
        return {
          clinicId,
          clinicName,
          platform: result.platform,
          count: result.count,
          error: result.error,
        }
      }
      case 'tiktok_ads': {
        const tiktokOpts = {
          clinicId,
          advertiserId: decrypted.advertiser_id as string,
          accessToken: decrypted.access_token as string,
        }
        const [campaignResult, adResult] = await Promise.all([
          fetchTikTokAds(date, tiktokOpts),
          fetchTikTokAdStats(date, tiktokOpts),
        ])
        return {
          clinicId,
          clinicName,
          platform: campaignResult.platform,
          count: campaignResult.count + adResult.count,
          error: campaignResult.error || adResult.error || undefined,
        }
      }
      default:
        return {
          clinicId,
          clinicName,
          platform: platform as string,
          count: 0,
          error: `Unknown platform: ${platform}`,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('동기화 실행 오류', error, { clinicId, platform })
    return {
      clinicId,
      clinicName,
      platform: API_PLATFORM_LABELS[platform],
      count: 0,
      error: message,
    }
  }
}

/**
 * 전체 활성 병원 동기화 (Cron용)
 * 1. clinic_api_configs에서 활성 설정 전체 조회
 * 2. clinic_id별 그룹핑 후 병원별 순차, 매체별 병렬 실행
 * 3. 설정 없는 경우 환경변수 폴백
 */
export async function syncAllClinics(date: Date = new Date()): Promise<SyncResult[]> {
  const supabase = serverSupabase()
  const allResults: SyncResult[] = []

  // 1. 활성 설정 전체 조회
  const { data: configs, error } = await supabase
    .from('clinic_api_configs')
    .select('id, clinic_id, platform, config, is_active, clinics(name)')
    .in('platform', SYNC_ENABLED_PLATFORMS as unknown as string[])
    .eq('is_active', true)

  if (error) {
    logger.error('clinic_api_configs 조회 실패', error)
  }

  const validConfigs = (configs || []) as unknown as ClinicApiConfig[]

  // 2. clinic_id별 그룹핑
  const clinicMap = new Map<number, { clinicName: string; platforms: Map<ApiPlatform, string | Record<string, unknown>> }>()

  for (const cfg of validConfigs) {
    if (!clinicMap.has(cfg.clinic_id)) {
      const clinicName = (cfg.clinics as { name: string } | null)?.name || `병원 ${cfg.clinic_id}`
      clinicMap.set(cfg.clinic_id, {
        clinicName,
        platforms: new Map(),
      })
    }
    clinicMap.get(cfg.clinic_id)!.platforms.set(cfg.platform as ApiPlatform, cfg.config)
  }

  // 3. 병원별 순차 실행, 매체별 병렬 실행
  for (const [clinicId, { clinicName, platforms }] of clinicMap) {
    logger.info('병원 동기화 시작', { clinicId, clinicName, platforms: Array.from(platforms.keys()) })

    const promises = Array.from(platforms.entries()).map(([platform, configStr]) =>
      syncPlatform(clinicId, clinicName, platform, configStr, date)
    )

    const settled = await Promise.allSettled(promises)

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allResults.push(result.value)
      } else {
        allResults.push({
          clinicId,
          clinicName,
          platform: 'Unknown',
          count: 0,
          error: result.reason?.message || String(result.reason),
        })
      }
    }
  }

  // 4. 설정 없는 경우: 환경변수 폴백 (기존 방식)
  if (clinicMap.size === 0) {
    logger.info('clinic_api_configs 설정 없음, 환경변수 폴백으로 동기화')

    const fallbackResults = await Promise.allSettled([
      Promise.all([fetchMetaAds(date), fetchMetaAdStats(date)]).then(([c, a]) => ({
        platform: c.platform,
        count: c.count + a.count,
        error: c.error || a.error || undefined,
      })),
      fetchGoogleAds(date),
      Promise.all([fetchTikTokAds(date), fetchTikTokAdStats(date)]).then(([c, a]) => ({
        platform: c.platform,
        count: c.count + a.count,
        error: c.error || a.error || undefined,
      })),
    ])

    const platformNames = ['meta_ads', 'google_ads', 'tiktok_ads']
    for (let i = 0; i < fallbackResults.length; i++) {
      const r = fallbackResults[i]
      if (r.status === 'fulfilled') {
        allResults.push({
          clinicId: null,
          clinicName: '환경변수 폴백',
          platform: r.value.platform,
          count: r.value.count,
          error: r.value.error,
        })
      } else {
        allResults.push({
          clinicId: null,
          clinicName: '환경변수 폴백',
          platform: platformNames[i],
          count: 0,
          error: r.reason?.message || String(r.reason),
        })
      }
    }
  }

  logger.info('전체 동기화 완료', {
    totalResults: allResults.length,
    successCount: allResults.filter(r => !r.error).length,
    failCount: allResults.filter(r => r.error).length,
  })

  return allResults
}

/**
 * 특정 병원 동기화 (수동 트리거용)
 * 1. 해당 clinicId의 clinic_api_configs 조회
 * 2. 설정된 매체만 동기화
 * 3. 없으면 환경변수 폴백
 */
export async function syncClinic(clinicId: number, date: Date = new Date()): Promise<SyncResult[]> {
  const supabase = serverSupabase()
  const results: SyncResult[] = []

  // 병원명 조회
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single()

  const clinicName = clinic?.name || `병원 ${clinicId}`

  // 해당 병원의 활성 설정 조회
  const { data: configs, error } = await supabase
    .from('clinic_api_configs')
    .select('id, clinic_id, platform, config, is_active')
    .eq('clinic_id', clinicId)
    .in('platform', SYNC_ENABLED_PLATFORMS as unknown as string[])
    .eq('is_active', true)

  if (error) {
    logger.error('clinic_api_configs 조회 실패', error, { clinicId })
  }

  const validConfigs = (configs || []) as unknown as ClinicApiConfig[]

  if (validConfigs.length > 0) {
    // 설정된 매체 병렬 동기화
    const promises = validConfigs.map(cfg =>
      syncPlatform(clinicId, clinicName, cfg.platform as ApiPlatform, cfg.config, date)
    )

    const settled = await Promise.allSettled(promises)

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({
          clinicId,
          clinicName,
          platform: 'Unknown',
          count: 0,
          error: result.reason?.message || String(result.reason),
        })
      }
    }
  } else {
    // 환경변수 폴백
    logger.info('병원별 설정 없음, 환경변수 폴백', { clinicId })

    const fallbackResults = await Promise.allSettled([
      Promise.all([fetchMetaAds(date), fetchMetaAdStats(date)]).then(([c, a]) => ({
        platform: c.platform,
        count: c.count + a.count,
        error: c.error || a.error || undefined,
      })),
      fetchGoogleAds(date),
      Promise.all([fetchTikTokAds(date), fetchTikTokAdStats(date)]).then(([c, a]) => ({
        platform: c.platform,
        count: c.count + a.count,
        error: c.error || a.error || undefined,
      })),
    ])

    const platformNames = ['meta_ads', 'google_ads', 'tiktok_ads']
    for (let i = 0; i < fallbackResults.length; i++) {
      const r = fallbackResults[i]
      if (r.status === 'fulfilled') {
        results.push({
          clinicId: null,
          clinicName: '환경변수 폴백',
          platform: r.value.platform,
          count: r.value.count,
          error: r.value.error,
        })
      } else {
        results.push({
          clinicId: null,
          clinicName: '환경변수 폴백',
          platform: platformNames[i],
          count: 0,
          error: r.reason?.message || String(r.reason),
        })
      }
    }
  }

  return results
}
