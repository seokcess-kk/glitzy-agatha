/**
 * 광고 통계 테이블 upsert 의 onConflict 키 생성 (단일 진실 공급원).
 *
 * `ad_campaign_stats` / `ad_group_stats` / `ad_stats` 는 client_id 유무에 따라
 * partial unique index 가 다르다:
 *   - 클라이언트별:  (client_id, platform, <id>, stat_date)
 *   - ENV 폴백(NULL): (platform, <id>, stat_date)
 *
 * 그동안 이 ternary 가 5개 매체 서비스 × 3개 테이블에 ~11회 복붙되던 것을 모았다.
 * 인덱스 설계가 바뀌면 이 한 곳만 고치면 된다(locality).
 */
export type AdStatsIdColumn = 'campaign_id' | 'adgroup_id' | 'ad_id'

export function adStatsOnConflict(idColumn: AdStatsIdColumn, hasClientId: boolean): string {
  return hasClientId
    ? `client_id,platform,${idColumn},stat_date`
    : `platform,${idColumn},stat_date`
}
