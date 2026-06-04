/**
 * 인입(Inflow) 계산 헬퍼
 *
 * "리드" / "매체 전환" / "인입" 3개 개념:
 *   - actualLeads:     leads 테이블의 row 수 (utm_source 로 채널 분류)
 *   - mediaConversions: ad_campaign_stats.conversions 합계 (매체가 보고한 전환수)
 *   - inflowCount:      운영 KPI 용 통합 지표. 채널 inflow_source 에 따라 둘 중 하나 선택
 *
 * 검색광고(네이버 SA)처럼 자체 랜딩이 없는 매체는 PLATFORM_INFLOW_DEFAULTS 가
 * 'media_conversion' 이라 leads 가 0 이어도 매체 전환수를 인입으로 노출한다.
 *
 * 클라이언트별 override 는 client_api_configs.config.inflow_source (선택).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type ApiPlatform,
  type InflowSource,
  PLATFORM_INFLOW_DEFAULTS,
  isApiPlatform,
} from '@/lib/platform'
import { decryptApiConfig } from '@/lib/crypto'

/** 매체별 inflow_source override 맵 (client_api_configs.config.inflow_source). */
export type InflowOverrideMap = Partial<Record<ApiPlatform, InflowSource>>

const VALID_INFLOW_SOURCES: InflowSource[] = ['lead_webhook', 'media_conversion', 'combined']

/**
 * 단일 클라이언트의 client_api_configs.config.inflow_source override 맵을 조회.
 * - config 는 암호화 저장(평문 JSON 폴백)이라 decryptApiConfig 로 복호화 후 읽는다.
 * - 전체조회(clientId 없음)에서는 클라이언트별 override 가 모호하므로 호출하지 않고 기본값 사용.
 * - 설정이 없거나 inflow_source 미지정이면 빈 맵 → 기존 PLATFORM_INFLOW_DEFAULTS 동작과 동일.
 */
export async function fetchInflowOverrides(
  supabase: SupabaseClient,
  clientId: number,
): Promise<InflowOverrideMap> {
  const { data, error } = await supabase
    .from('client_api_configs')
    .select('platform, config')
    .eq('client_id', clientId)
  if (error || !data) return {}

  const map: InflowOverrideMap = {}
  for (const row of data as { platform: string; config: unknown }[]) {
    if (!isApiPlatform(row.platform)) continue
    const cfg =
      typeof row.config === 'string'
        ? decryptApiConfig(row.config)
        : (row.config as Record<string, unknown> | null)
    const src = cfg?.inflow_source
    if (typeof src === 'string' && VALID_INFLOW_SOURCES.includes(src as InflowSource)) {
      map[row.platform as ApiPlatform] = src as InflowSource
    }
  }
  return map
}

/**
 * 매체별 inflow source 결정.
 * config.inflow_source override 가 있으면 그것 우선, 없으면 PLATFORM_INFLOW_DEFAULTS.
 */
export function resolveInflowSource(
  platform: ApiPlatform,
  configOverride?: InflowSource | null,
): InflowSource {
  return configOverride ?? PLATFORM_INFLOW_DEFAULTS[platform]
}

/**
 * 단일 채널의 인입 카운트 계산.
 *   - lead_webhook:     actualLeads 사용 (mediaConversions 무시)
 *   - media_conversion: mediaConversions 사용 (actualLeads 무시)
 *   - combined:         actualLeads + mediaConversions 단순 합산.
 *                       자체 랜딩 + 매체 자체 폼/픽셀 트래킹을 같은 채널에서
 *                       동시 운영하는 케이스(예: Meta) 용. 동일 사용자가 두
 *                       경로로 동시 보고될 시 이중 카운트 위험 — 캠페인
 *                       단위 트래킹 분리(랜딩에는 픽셀 lead 미설치 등)로 회피.
 *
 * manualBoost: manual_inflows 테이블의 일자별 보정값. inflow_source 와 무관하게
 *   결과에 무조건 합산된다. 매체(특히 ADN)가 매체 전환을 누락하는 케이스에
 *   대비한 수동 보정. 기본 0.
 */
export function computeInflowCount(
  actualLeads: number,
  mediaConversions: number,
  inflowSource: InflowSource,
  manualBoost: number = 0,
): number {
  let base: number
  if (inflowSource === 'lead_webhook') base = actualLeads
  else if (inflowSource === 'media_conversion') base = mediaConversions
  else base = actualLeads + mediaConversions
  return base + manualBoost
}

/**
 * 채널명(예: 'Naver', 'Meta') → ApiPlatform 매핑.
 * channel API 가 normalizeChannel 로 'Naver' 등 라벨을 사용하므로 역매핑 필요.
 * inflow_source 결정에만 사용 (없는 채널은 null 반환 → 호출자가 lead_webhook 폴백).
 */
const CHANNEL_TO_API_PLATFORM: Record<string, ApiPlatform> = {
  Meta: 'meta_ads',
  Google: 'google_ads',
  TikTok: 'tiktok_ads',
  Naver: 'naver_ads',
  Kakao: 'kakao_ads',
  Dable: 'dable_ads',
  ADN: 'adn_ads',
}

export function channelToApiPlatform(channel: string): ApiPlatform | null {
  const direct = CHANNEL_TO_API_PLATFORM[channel]
  if (direct) return direct
  if (isApiPlatform(channel)) return channel
  return null
}

/**
 * 채널명으로 inflow source 결정 (PLATFORM_INFLOW_DEFAULTS 폴백).
 * 매핑 안 되는 채널(예: 'Organic', 'Unknown')은 'lead_webhook' 폴백.
 */
export function resolveInflowSourceForChannel(
  channel: string,
  overrides?: InflowOverrideMap,
): InflowSource {
  const platform = channelToApiPlatform(channel)
  if (!platform) return 'lead_webhook'
  return overrides?.[platform] ?? PLATFORM_INFLOW_DEFAULTS[platform]
}

/**
 * platform 의 매체 전환수를 인입에 합산해야 하는가? (단일 진실 공급원)
 *   media_conversion / combined → true,  lead_webhook → false,  비-API platform → false.
 * 그동안 각 라우트가 `isApiPlatform(p) && PLATFORM_INFLOW_DEFAULTS[p] !== 'lead_webhook'`
 * 를 인라인 재구현하던 게이트 술어를 한 곳으로 모은 것. override 도 동일 기준으로 반영.
 */
export function countsMediaConversions(
  platform: string,
  overrides?: InflowOverrideMap,
): boolean {
  if (!isApiPlatform(platform)) return false
  const src = overrides?.[platform] ?? PLATFORM_INFLOW_DEFAULTS[platform]
  return src !== 'lead_webhook'
}
