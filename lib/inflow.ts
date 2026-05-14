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

import {
  type ApiPlatform,
  type InflowSource,
  PLATFORM_INFLOW_DEFAULTS,
  isApiPlatform,
} from '@/lib/platform'

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
 *
 * 두 source 를 더하면 중복 집계 위험 (랜딩 폼 + 매체 전환이 같은 사건 보고 가능).
 */
export function computeInflowCount(
  actualLeads: number,
  mediaConversions: number,
  inflowSource: InflowSource,
): number {
  return inflowSource === 'lead_webhook' ? actualLeads : mediaConversions
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
export function resolveInflowSourceForChannel(channel: string): InflowSource {
  const platform = channelToApiPlatform(channel)
  if (!platform) return 'lead_webhook'
  return PLATFORM_INFLOW_DEFAULTS[platform]
}
