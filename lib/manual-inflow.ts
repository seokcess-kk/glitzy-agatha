/**
 * manual_inflows 조회/집계 헬퍼
 *
 * 인입 KPI/추세/채널 집계 API 에서 사용. 한 번 조회한 결과를 인메모리에서
 * 빠르게 합산하기 위한 인덱싱 함수도 함께 제공.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getKstDateString } from '@/lib/date'

export interface ManualInflowRow {
  client_id: number
  platform: string
  stat_date: string  // YYYY-MM-DD (KST)
  count: number
}

/**
 * 채널명(예: 'ADN', 'Meta') 으로 lookup 할 수 있게 인덱싱한 보정값 맵.
 * 키: `${normalizedChannel}|${stat_date}` (정확 매칭)
 * 키: `${normalizedChannel}` (전체 기간 합)
 */
export interface ManualInflowIndex {
  /** 채널별 × 일자별 합 */
  byChannelDate: Map<string, number>
  /** 채널별 전체 합 */
  byChannel: Map<string, number>
  /** 전체 합 (모든 채널, 모든 일자) */
  total: number
}

/**
 * 지정 기간/플랫폼 의 manual_inflows 를 조회.
 * - clientIds === null: 클라이언트 필터 없음 (superadmin 전체 조회용)
 * - clientIds 가 빈 배열: 빈 결과 반환 (agency_staff 배정 0개)
 * - platforms 가 비어있으면 모든 매체 조회
 */
export async function fetchManualInflows(
  supabase: SupabaseClient,
  params: {
    clientIds: number[] | null
    startDate: Date | string
    endDate: Date | string
    platforms?: string[]
  },
): Promise<ManualInflowRow[]> {
  const { clientIds, startDate, endDate, platforms } = params
  if (clientIds !== null && clientIds.length === 0) return []

  const startStr = typeof startDate === 'string' ? startDate : getKstDateString(startDate)
  const endStr = typeof endDate === 'string' ? endDate : getKstDateString(endDate)

  let query = supabase
    .from('manual_inflows')
    .select('client_id, platform, stat_date, count')
    .gte('stat_date', startStr)
    .lte('stat_date', endStr)

  if (clientIds !== null) {
    query = query.in('client_id', clientIds)
  }

  if (platforms && platforms.length > 0) {
    query = query.in('platform', platforms)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as ManualInflowRow[]
}

/**
 * platform(예: 'adn_ads') → 채널명(예: 'ADN') 매핑.
 * 채널 집계 키와 일치하도록 정규화.
 */
const PLATFORM_TO_CHANNEL: Record<string, string> = {
  meta_ads: 'Meta',
  google_ads: 'Google',
  tiktok_ads: 'TikTok',
  naver_ads: 'Naver',
  kakao_ads: 'Kakao',
  dable_ads: 'Dable',
  adn_ads: 'ADN',
}

/**
 * 조회한 행 배열을 채널/일자별로 합산한 인덱스로 변환.
 * 컴포넌트/라우트에서 채널명 또는 (채널, 일자) 키로 O(1) 조회 가능.
 */
export function indexManualInflows(rows: ManualInflowRow[]): ManualInflowIndex {
  const byChannelDate = new Map<string, number>()
  const byChannel = new Map<string, number>()
  let total = 0

  for (const r of rows) {
    const channel = PLATFORM_TO_CHANNEL[r.platform] || r.platform
    const dateKey = `${channel}|${r.stat_date}`
    byChannelDate.set(dateKey, (byChannelDate.get(dateKey) || 0) + r.count)
    byChannel.set(channel, (byChannel.get(channel) || 0) + r.count)
    total += r.count
  }

  return { byChannelDate, byChannel, total }
}

/**
 * 특정 채널의 보정값 조회 (전체 기간 합).
 */
export function getManualBoostForChannel(
  index: ManualInflowIndex,
  channel: string,
): number {
  return index.byChannel.get(channel) || 0
}

/**
 * 특정 채널 × 일자의 보정값 조회.
 * 일별 추세 차트 등에 사용.
 */
export function getManualBoostForChannelDate(
  index: ManualInflowIndex,
  channel: string,
  statDate: string,
): number {
  return index.byChannelDate.get(`${channel}|${statDate}`) || 0
}
