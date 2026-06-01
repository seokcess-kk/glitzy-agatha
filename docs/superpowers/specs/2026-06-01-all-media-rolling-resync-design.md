# 전 매체 N일 Rolling Resync 설계

**작성일**: 2026-06-01
**목적**: 광고 매체의 전환 지연(conversion lag)으로 인한 과거 날짜 전환수 누락을 전 매체에서 자동 보정한다.

## 배경 / 문제

- 메인 cron `sync-ads`(KST 06:00)는 **어제치 1회만** 동기화한다(`syncAllClients(yesterday)`).
- 그러나 Google·Meta·TikTok·Naver·ADN 모두 전환을 클릭 후 며칠~몇 주 뒤 **소급 집계**한다(전환 지연). 1회 동기화 후 후행 전환이 반영되지 않아 우리 DB 수치가 매체 UI보다 작게 고착된다.
  - 실측 사례(2026-06-01): 봉명동내커피 Google 전환이 우리 DB 82 vs Google UI 85.46. 해당 기간을 재백필하니 일치.
- 현재 **네이버만** `resyncNaverCampaigns(21)`로 21일 rolling 재동기화(`/api/cron/sync-naver-resync`, KST 07:00)를 한다. 나머지 매체는 보정이 없다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 재동기화 윈도우 | **전 매체 14일** (네이버만 추적기간 20일 고려해 21일 유지) |
| 재동기화 범위 | **캠페인 레벨만** (ad/소재 레벨 제외 — timeout 회피, 인입/전환 KPI는 캠페인 레벨로 집계) |
| 아키텍처 | **매체별 cron 분리** (timeout 격리, 네이버 검증 패턴 확장) |

## 컴포넌트

### 1. `lib/services/adSyncManager.ts`

**`resyncPlatformCampaigns(platform: ApiPlatform, daysBack = 14): Promise<SyncResult[]>`**
기존 `resyncNaverCampaigns`를 일반화한다.
- `client_api_configs`에서 해당 `platform`의 활성 설정을 **1회** 조회
- `dates` = 어제 ~ `daysBack`일 전 (오늘은 메인 cron 직후라 제외, 네이버와 동일)
- 설정이 없으면 ENV 폴백(클라이언트 ID 없이 매체 캠페인 fetch)
- 설정이 있으면 클라이언트 순차 · 날짜 순차로 **캠페인 레벨 fetch만** 호출
- `upsert`라 멱등

**`fetchCampaignsForPlatform(platform, date, decrypted?, clientId?)`** (내부 헬퍼)
- platform → 캠페인 레벨 fetch 매핑: `fetchMetaAds`/`fetchGoogleAds`/`fetchTikTokAds`/`fetchNaverAds`/`fetchAdnAds`
- `decrypted`가 있으면 클라이언트 opts로, 없으면 opts 없이(ENV 폴백) 호출
- 반환 형태 통일: `{ platform, count, error? }`

**`resyncNaverCampaigns` 제거** → 호출처(`sync-naver-resync` route)를 `resyncPlatformCampaigns('naver_ads', 21)`로 변경(중복 제거).

### 2. cron route 4개 — `app/api/cron/`
`sync-naver-resync` route 패턴을 그대로 복제:
- `sync-meta-resync` → `resyncPlatformCampaigns('meta_ads', 14)`
- `sync-google-resync` → `resyncPlatformCampaigns('google_ads', 14)`
- `sync-tiktok-resync` → `resyncPlatformCampaigns('tiktok_ads', 14)`
- `sync-adn-resync` → `resyncPlatformCampaigns('adn_ads', 14)`

각 route: `CRON_SECRET` 인증, `maxDuration = 300`, 실패 집계 후 `sendErrorAlert`.

### 3. cron 스케줄 — `vercel.json`
```
sync-ads           UTC 21:00 / KST 06:00  (기존)
sync-naver-resync  UTC 22:00 / KST 07:00  (기존, 21일)
sync-meta-resync   UTC 22:15 / KST 07:15  (신규, 14일)
sync-google-resync UTC 22:30 / KST 07:30  (신규, 14일)
sync-tiktok-resync UTC 22:45 / KST 07:45  (신규, 14일)
sync-adn-resync    UTC 22:50 / KST 07:50  (신규, 14일)
send-reports       UTC 23:00 / KST 08:00  (기존 — resync 이후라 보정 데이터 반영)
```
cron 총 7개(Vercel Pro 40개 제한 내). 시차 실행으로 부하·rate limit 분산.

## 에러 처리 / 멱등성

- 매체별 cron 독립 → 한 매체 API 장애가 다른 매체 resync에 영향 없음(격리).
- 클라이언트/매체별 실패는 `SyncResult.error`로 집계, 실패 시 `sendErrorAlert('ad_sync_fail', …)`.
- 모든 fetch는 `stat_date` UNIQUE 키 upsert라 재실행해도 안전(멱등).

## 비목표 (YAGNI)

- ad/소재 레벨 resync (timeout 위험, KPI 영향 적음 — 추후 필요 시)
- QStash fan-out (현재 규모엔 과설계 — 클라이언트 급증 시 재검토)
- `conversions` 컬럼 DECIMAL 전환 (소수점 정밀도는 사용자가 불필요로 결정)
