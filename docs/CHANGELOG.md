# 변경 이력 (Agatha)

규칙 추가/수정 시 날짜와 사유를 기록. 불필요해진 규칙은 삭제하되 이력에 사유 남길 것.

## API 설정 다이얼로그 부분 업데이트 지원 + 에러 표시 안전망 (2026-05-20)

| 날짜 | 내용 |
|------|------|
| 2026-05-20 | fix: `app/api/admin/clients/[id]/api-configs/route.ts` POST 핸들러에 기존 config 머지 로직 추가. 마스킹된 민감 필드(`****`)는 요청에서 빠지지만 DB의 기존 값으로 채워 필수 필드 검증을 통과시킴 → 부분 업데이트 가능. 이전엔 한 필드만 수정하려 해도 5개 모두 재입력 강제됐음 |
| 2026-05-20 | fix: `app/api/admin/clients/[id]/api-configs/test/route.ts` `extractErrorMessage()` 헬퍼 추가. `google-ads-api`가 던지는 `{ errors: [{ message, errorCode }] }` 형태 에러를 사람이 읽을 수 있는 문자열로 변환 (`[object Object]` 표시 방지). 추가로 `customer_id` 하이픈 자동 제거 및 `login_customer_id`(MCC 경유) 옵션 지원 |
| 2026-05-20 | fix: `components/admin/ClientApiConfigDialog.tsx` `toErrorMessage()` 헬퍼로 응답 객체의 error 필드가 객체로 내려와도 문자열로 안전 변환. handleSave/handleTest/handleDelete 3곳 모두 적용 |

## 메뉴 구조 재정의 후속 — 인입 배지 / 사이드바 들여쓰기 / e2e 정리 (2026-05-18)

| 날짜 | 내용 |
|------|------|
| 2026-05-18 | feat: `components/ads/campaign-ranking-table.tsx` 인입 컬럼에 inflowSource 배지(`매`/`복합`) + 분해 tooltip 추가. 매체 전환 기반(네이버 SA 등) / combined(Meta) / lead_webhook 을 시각적으로 구분. `dashboard/channel-table` 과 동일 패턴으로 일관성 확보 |
| 2026-05-18 | feat: 사이드바 `MenuItem.subItem` 플래그 추가. '캠페인 분석' 항목에 적용 — 펼친 상태에서 들여쓰기(pl-9) + 작은 아이콘(14px) + text-xs 보조 색상으로 광고 성과의 하위 뷰임을 시각화. 축소 상태는 기존 동일 |
| 2026-05-18 | chore: e2e 잔재 정리 — `e2e/pages/leads.page.ts`, `e2e/tests/{auth,dashboard,leads}.spec.ts` 의 `/leads` 경로를 `/customers` 로 일괄 치환. `dashboard.navigateTo('리드')` → `'리드·고객'` 라벨 동기화 |

## 메뉴 구조 재정의 — /campaigns 폐기 + 라벨 정리 (2026-05-18)

| 날짜 | 내용 |
|------|------|
| 2026-05-18 | refactor: `app/(dashboard)/campaigns/` 및 `app/api/campaigns/` 삭제. `/ads?tab=campaigns` 의 캠페인 분석 탭과 데이터·컬럼 중복(지출/노출/클릭/인입/CPL) 이라 별도 메뉴 정당성 없음. 캠페인 단위 리드 처리 기능은 `/customers > 리드 탭` 의 campaign 필터로 대체 |
| 2026-05-18 | feat: 사이드바 메뉴 재구성 — '캠페인'(`/campaigns`) → '캠페인 분석'(`/ads?tab=campaigns` deep link), '고객관리'(`/customers`) → '리드·고객'. menuKey 는 호환을 위해 'campaigns'/'leads' 유지 (기존 user_menu_permissions / system_settings.hidden_menus 데이터 호환) |
| 2026-05-18 | feat: `components/Sidebar.tsx` `isActive` 로직을 querystring 매칭 지원하도록 확장. href 에 `?tab=...` 등이 있으면 pathname + 모든 query 일치 시에만 활성. 같은 pathname 의 deep link 형제가 활성이면 base 항목은 비활성 (`/ads?tab=campaigns` 활성 시 `/ads` 비활성) |
| 2026-05-18 | refactor: `Sidebar` 를 Suspense boundary 로 감싸 `useSearchParams()` prerender 안전 보장 |
| 2026-05-18 | chore: `app/(dashboard)/customers/{page,layout}.tsx`, `app/(dashboard)/admin/{users,settings}/page.tsx` 라벨 일괄 '고객관리' → '리드·고객', '캠페인' → '캠페인 분석' |

## 광고 소재에 외부 URL 도착지 + creatives Storage 버킷 (2026-05-15)

| 날짜 | 내용 |
|------|------|
| 2026-05-15 | feat: `ad_creatives.external_url TEXT` 컬럼 추가 (`20260515_ad_creatives_external_url.sql`). 랜딩페이지(`landing_page_id`) 대신 외부 URL을 도착지로 지정 가능. 양자택일 — 둘 다 입력 시 API/UI에서 400 |
| 2026-05-15 | feat: `app/api/admin/ad-creatives/route.ts`, `[id]/route.ts` — `external_url` 입력 받음. `sanitizeUrl()` + `http(s)://` 강제. utm_links 자동 생성 시 `landing_page_id` 우선, 없으면 `external_url`을 base로 |
| 2026-05-15 | feat: `app/(dashboard)/admin/ad-creatives/page.tsx` — 등록/수정 다이얼로그에 "외부 URL" 입력 추가. 한 쪽 입력 시 다른 쪽 disabled로 양자택일 강제. 펼침 패널/UTM URL 미리보기/QR 모두 external_url 지원 |
| 2026-05-15 | fix: Supabase Storage `creatives` 버킷 부재로 "업로드 URL 생성 실패: The related resource does not exist" 에러 발생. service_role로 버킷 생성 (`public=true, fileSizeLimit=50MB`, 이미지/MP4/WebM MIME 화이트리스트). 운영 스크립트 `scripts/ensure-creatives-bucket.ts` |

## Meta ad-level 매체 전환 매핑 + 소재별 성과 인입 합산 (2026-05-15)

| 날짜 | 내용 |
|------|------|
| 2026-05-15 | feat: `supabase/migrations/20260515_ad_stats_conversions.sql` — `ad_stats` 에 `conversions INTEGER DEFAULT 0` 컬럼 추가. 캠페인 단위 `ad_campaign_stats.conversions` 만으로는 어느 소재(utm_content)에서 전환났는지 알 수 없는 한계를 ad-level 으로 확장 |
| 2026-05-15 | feat: `lib/services/metaAds.ts` `fetchMetaAdStats` — Insights API fields 에 `actions` 추가, `extractLeadConversions()` 로 lead 류 액션 합산해 `ad_stats.conversions` 저장 |
| 2026-05-15 | feat: `/api/ads/creatives-performance` — utm_content 매칭 시 `ad_stats.conversions` 합산. inflowSource 가 `combined`(Meta) 면 `actualLeads + conversions`, `media_conversion` 이면 conversions, `lead_webhook` 이면 actualLeads 만. ad_id 단위 표시(utm_content 없는 TikTok/Google) 도 동일 분기 적용 |
| 2026-05-15 | fix: `/api/dashboard/kpi` mediaConversionsTotal 합산 분기를 `!== 'media_conversion'` → `=== 'lead_webhook'` 로 변경. combined 모드(Meta) 가 KPI 카드 인입에 반영되지 않던 버그 해소 (대시보드/광고 페이지 상단 KPI 두 곳에 영향) |

## ERP 거래처 이름 동기화를 '이름 갱신만' 모드로 제한 (2026-05-15)

| 날짜 | 내용 |
|------|------|
| 2026-05-15 | fix: `POST /api/admin/erp-clients/sync` 가 매핑 안 된 ERP 거래처도 자동 INSERT 하던 동작 제거. 이미 `erp_client_id`로 매핑된 `clients` 행의 `name`만 ERP 기준으로 갱신. 신규 매핑은 webhook(`/api/webhook/erp-client`) 또는 사용자 등록 흐름으로만 |
| 2026-05-15 | refactor: 응답 형태 변경 — `{ created, updated, skipped, total }` → `{ matched, updated, skipped, mappingMissing, unmapped }`. UI 호출자 없음(검색 결과 0건) |

## Inflow `combined` 모드 도입 + Meta conversions 매핑 (2026-05-15)

| 날짜 | 내용 |
|------|------|
| 2026-05-15 | feat: `InflowSource` 에 `'combined'` 추가 (`lib/platform.ts`). `computeInflowCount` 분기 추가 — `actualLeads + mediaConversions` 단순 합산 (`lib/inflow.ts`). 자체 랜딩과 매체 자체 폼/픽셀 트래킹을 같은 채널에서 동시 운영하는 케이스(예: Meta) 용 |
| 2026-05-15 | feat: `PLATFORM_INFLOW_DEFAULTS.meta_ads = 'combined'`. 기존 'lead_webhook' → 자체 랜딩 + 메타 픽셀/Lead Ads 전환 모두 인입 카운트 |
| 2026-05-15 | feat: `lib/services/metaAds.ts` — Insights API 에 `actions` 필드 추가, `extractLeadConversions()` 헬퍼로 lead 류 액션(`lead`, `offsite_conversion.fb_pixel_lead`, `onsite_conversion.lead_grouped`) 합산 → `ad_campaign_stats.conversions` 저장 |
| 2026-05-15 | feat: 5개 API(`dashboard/{trend,campaign}`, `ads/{day-analysis,efficiency-trend,platform-summary}`) + `creatives-performance` + `campaign-ranking-table` 의 conversions 합산 분기를 `=== 'media_conversion'` → `!== 'lead_webhook'` 로 변경. combined 모드도 자동 합산 |
| 2026-05-15 | feat: 채널 테이블 UI(`components/dashboard/channel-table.tsx`) "복합" 배지 + tooltip ("리드 + 매체 전환 합산") 추가. 기존 "매" 배지는 `media_conversion` 전용 유지 |
| 2026-05-15 | note: 기존 Meta `ad_campaign_stats.conversions` 는 0 상태 → 백필 재실행 시 새로 채워짐. 동일 사용자가 자체 랜딩 폼 + Meta 픽셀 lead 둘 다 발사 시 이중 카운트 위험 (캠페인 트래킹 분리로 회피) |

## ADN(Across DN) 매체 추가 (2026-05-14)

| 날짜 | 내용 |
|------|------|
| 2026-05-14 | feat: `lib/platform.ts` — `adn_ads` 추가 (`API_PLATFORMS / SYNC_ENABLED_PLATFORMS / API_PLATFORM_LABELS('ADN') / API_PLATFORM_SHORT('A') / API_PLATFORM_FIELDS([api_key]) / API_REQUIRED_FIELDS / CAMPAIGN_TYPES_BY_PLATFORM(['display'])`). `PLATFORM_INFLOW_DEFAULTS.adn_ads = 'media_conversion'` (디스플레이 네트워크, 매체 conv_cnt 기반) |
| 2026-05-14 | feat: `lib/channel.ts` / `lib/channel-colors.ts` — 'adn' / 'across' / 'acrosspf' → 'ADN' 매핑, 색상 cyan-500(`#06b6d4`) |
| 2026-05-14 | feat: `components/ui/badge.tsx` `adn` variant + `components/common/channel-badge.tsx` adn 분기 |
| 2026-05-14 | feat: `lib/services/adnAds.ts` 신규 — `fetchAdnAds()`. `GET https://manage.acrosspf.com/api/api_report/across_adn_api_report.php` (헤더 `API-KEY`). 응답 일별→캠페인→groups 3-tier 파싱, `ad_campaign_stats` + `ad_group_stats` 동시 upsert. campaign_id/group_id 부재 → name 그대로 ID 사용. ad/소재 단위 없음(`fetchAdnAdStats` 미구현). 환경변수 폴백 `ADN_ADS_API_KEY` |
| 2026-05-14 | feat: `lib/services/adSyncManager.ts` — `case 'adn_ads'` 추가, `syncAllClients`/`syncClient` 환경변수 폴백 경로에 `fetchAdnAds` 포함. `/api/admin/backfill-ads` 도 자동 적용 (skipAdLevel 무관 — ad 레벨 없음) |
| 2026-05-14 | note: ADN 은 `media_conversion` 모드라 `creatives-performance / dashboard/campaign / platform-summary / day-analysis / efficiency-trend / campaign-ranking-table` 등 인입 모델 적용된 모든 화면에 자동 노출 |

## 광고그룹 단위 통계 — 검색광고용 운영 단위 통합 (2026-05-14)

| 날짜 | 내용 |
|------|------|
| 2026-05-14 | feat: `ad_group_stats` 테이블 신설 (`20260514_ad_group_stats.sql`). 컬럼 = `client_id / platform / campaign_id+name / adgroup_id+name / stat_date / impressions / clicks / spend_amount / conversions`. 일반 UNIQUE `(client_id, platform, adgroup_id, stat_date)` + `client_id IS NULL` partial UNIQUE (환경변수 폴백 모드 호환). RLS enable (service_role 우회) |
| 2026-05-14 | feat: `lib/services/naverAds.ts` — AD/AD_CONVERSION 리포트 row[3]=nccAdgroupId 동시 집계. `/ncc/adgroups` 호출로 광고그룹 이름 매핑. `ad_campaign_stats` + `ad_group_stats` 동시 upsert |
| 2026-05-14 | feat: `/api/ads/creatives-performance` `ad_group_stats` 병렬 조회 후 광고그룹 row 를 creative 결과에 통합. `campaign_ids = [campaign_id]` 로 기존 캠페인 필터 흡수. `media_conversion` 모드(네이버 SA)는 `conversions → leads` 매핑 (CPL 일관), `lead_webhook` 모드는 광고그룹별 lead 매칭 미구현 → 0 |
| 2026-05-14 | chore: 이전 임시 디버그 로그 제거 — `creatives-performance/route.ts` `[debug:creative-summary]`, `CreativePerformance.tsx` `[debug:creative-filter]` |

## 인입(Inflow) 통합 확장 — 광고/캠페인/요일/효율/랜딩/소재 (2026-05-14)

| 날짜 | 내용 |
|------|------|
| 2026-05-14 | feat: `/api/dashboard/campaign` 응답에 `actualLeads / mediaConversions / inflowCount / inflowSource` 추가. CPL/bookingRate/conversionRate 분모를 inflowCount 로. 정렬 inflowCount 기준 |
| 2026-05-14 | feat: `/api/ads/platform-summary` 응답에 인입 4 필드 추가. sources 도 각 소스 단위 inflowCount 적용. CPL/conversionRate 인입 기준 |
| 2026-05-14 | feat: `/api/ads/day-analysis` 요일별 actualLeads / mediaConversions / inflowCount 추가. CPL 인입 기준 |
| 2026-05-14 | feat: `/api/ads/efficiency-trend` 일별 actualLeads / mediaConversions / inflowCount 추가. CPL 인입 기준 |
| 2026-05-14 | feat: UI 라벨 일괄 통일 — 요일별 인입 분석, 광고 퍼널 "인입" 단계, 캠페인 랭킹 "인입" 컬럼, 플랫폼 비교 "인입" 컬럼, 총 인입 KPI, 랜딩페이지 인입 차트/테이블, 광고 소재 인입 컬럼, 최근 인입 위젯, 전환 퍼널 "인입 대비" |
| 2026-05-14 | note: `/api/dashboard/funnel` 은 leads status 기반 추적이라 매체 전환 합산 시 퍼널 왜곡 위험 → 변경 X. 라벨만 funnel-section 에서 통일. `/api/ads/stats` raw 데이터 반환이라 변경 X (소비자 컴포넌트에서 처리) |

## 인입(Inflow) 모델 도입 — KPI/Channel/Trend/SMS (2026-05-14)

| 날짜 | 내용 |
|------|------|
| 2026-05-14 | feat: "리드 / 매체 전환 / 인입" 3개 개념 분리. 네이버 SA 처럼 자체 랜딩 없이 매체 전환수로만 유입 측정되는 채널을 대시보드에 정합성 있게 통합 |
| 2026-05-14 | feat: `lib/platform.ts` — `InflowSource` 타입 + `PLATFORM_INFLOW_DEFAULTS` (naver_ads=media_conversion, 나머지=lead_webhook) |
| 2026-05-14 | feat: `lib/inflow.ts` (신규) — `resolveInflowSourceForChannel`, `computeInflowCount`, 채널→플랫폼 매핑 헬퍼 |
| 2026-05-14 | feat: `/api/dashboard/channel` 응답에 `actualLeads / mediaConversions / inflowCount / inflowSource` 4 필드 추가. spend 만 있고 leads 0 인 채널(네이버 SA) 결과 포함되도록 채널 집합 합집합 사용 |
| 2026-05-14 | feat: `/api/dashboard/kpi` 응답에 `actualLeads / mediaConversionsTotal / inflowCountTotal` 추가. CPL 분모를 inflowCountTotal 로 전환. 기존 `totalLeads` 키는 inflowCountTotal 동일값 (호환) |
| 2026-05-14 | feat: `/api/dashboard/trend` 일별 `actualLeads / mediaConversions / inflowCount` 추가. 매체 전환수는 media_conversion 모드 플랫폼만 합산 (이중 집계 방지) |
| 2026-05-14 | feat: KPI 카드 "리드"→"인입" 라벨. 매체 전환이 있으면 subtitle 에 `리드 N · 매체 M` 분해. actualLeads=0 && mediaConversions>0 케이스는 클릭 시 광고 페이지로 (고객관리 비어 보임 방지) |
| 2026-05-14 | feat: 채널 테이블 "리드"→"인입" 컬럼. 매체 전환 기반 채널에 "매" 배지 + hover 툴팁 (`매체 전환 기반 (검색광고 NPLA 전환추적)`) |
| 2026-05-14 | feat: 광고비·리드 추이 → "광고비·인입 추이". 차트 line name "리드 수"→"인입 수" |
| 2026-05-14 | feat: SMS 일일 리포트 `send-reports` cron 인입 기준 동기화. 매체 전환 있으면 `인입: N건 (리드 X · 매체 Y)` 분해. CPL 분모 인입 카운트 |

## Naver SA 캠페인 stats 정공법 전환 — /stat-reports (2026-05-14)

| 날짜 | 내용 |
|------|------|
| 2026-05-14 | fix: `/stats` 단일 ID + multi-value + JSON 배열 + statType=CAMPAIGN 5가지 조합 모두 400 거부 확인 후 `/stat-reports` 비동기 보고서 API 로 정공법 전환 |
| 2026-05-14 | feat: `fetchNaverStatReport(reportTp, statDt, auth)` 신설 — POST `/stat-reports` → 폴링 (REGIST/RUNNING/WAITING/AGGREGATING → BUILT) → downloadUrl TSV 다운로드 (시그니처 헤더 필수) |
| 2026-05-14 | feat: `fetchNaverAds` 가 AD 리포트(impressions/clicks/cost) + AD_CONVERSION 리포트(conversions) 두 결과를 campaign_id 기준 merge → `ad_campaign_stats` upsert |
| 2026-05-14 | note: 매핑 검증 완료 — AD `[2]=campaignId, [9]=imp, [10]=clk, [11]=cost`, AD_CONVERSION `[2]=campaignId, [10]=전환이벤트명("lead"), [11]=conversions`. 광고관리 화면값과 1763/15/104161/3 정확 매칭 |
| 2026-05-14 | chore: `_tmp_*` gitignore 추가 (로컬 참고용 외부 저장소 무시) |
| 2026-05-14 | chore: `tsconfig.json` exclude 에 `_tmp_*` 추가 (빌드 영향 차단) |

## Naver SA 전환수(convCnt) 수집 보강 & 21일 rolling resync (2026-05-14)

| 날짜 | 내용 |
|------|------|
| 2026-05-14 | fix: `lib/services/naverAds.ts:139` — `/stats` 요청 fields 배열에 `convCnt` 누락. `ad_campaign_stats.conversions` 매핑은 이미 있었으나 응답에 필드가 없어 항상 0으로 저장되던 버그 |
| 2026-05-14 | feat: `lib/services/adSyncManager.ts` — `resyncNaverCampaigns(daysBack=21)` 헬퍼 추가. 네이버 전환추적기간 내 후행 보정 대응을 위해 최근 N일 캠페인 레벨 재동기화. ad 레벨은 1차 범위 밖 (5000+ 소재 timeout 위험) |
| 2026-05-14 | feat: `/api/cron/sync-naver-resync` 신규 cron route — 매일 UTC 22:00 (KST 07:00) 실행, 메인 `sync-ads`(KST 06:00)와 `send-reports`(KST 08:00) 사이 |
| 2026-05-14 | feat: `vercel.json` — `sync-naver-resync` cron 등록 |
| 2026-05-14 | note: "리드/매체 전환/인입" 개념 분리. 네이버 SA처럼 자체 랜딩 없이 광고주 사이트로 송출하는 검색광고는 `leads`에 들어오지 않으므로 `ad_campaign_stats.conversions`를 "매체 전환"으로 별도 표기 예정. UI/API 노출은 2차 작업 |

## 레거시 테이블 참조 일괄 제거 (2026-05-04)

| 날짜 | 내용 |
|------|------|
| 2026-05-04 | fix: Agatha 도메인 리네이밍 후에도 존재하지 않는 레거시 테이블(`payments`/`bookings`/`consultations`/`content_posts`)을 참조해 500 에러를 발생시키던 11개 라우트를 SPEC.md 도메인 모델에 맞춰 leads 기반으로 정리 |
| 2026-05-04 | refactor: `app/api/dashboard/kpi`, `app/api/dashboard/campaign` — 매출/예약/상담 카운트를 leads.status 기반으로 통일. 응답 호환 키 유지 |
| 2026-05-04 | refactor: `app/api/ads/{platform-summary,landing-page-performance,landing-page-analysis,creatives-performance}` — payments/bookings 쿼리를 leads 단일 소스로 대체 |
| 2026-05-04 | refactor: `app/api/attribution/{contacts,roas-trend,summary}` — 결제 매출을 `leads where status='converted'+conversion_value`(status_changed_at 기준)로 대체. first/linear/time-decay 모델 모두 동작 |
| 2026-05-04 | refactor: `app/api/admin/landing-pages/stats` — payments+bookings → leads 단일 소스 |
| 2026-05-04 | fix: `app/api/leads/[id]` — bookings 자동생성 로직 제거 (테이블 없음). 상태값을 SPEC 표준(new/in_progress/converted/hold/lost/invalid)으로 정리 |
| 2026-05-04 | refactor: `app/api/leads/route.ts`, `app/api/leads/export/route.ts` — contacts select 외래키에서 payments/bookings/consultations 제거. 응답 호환 키는 leads.status 파생 값으로 채움. CSV 헤더 "시술" → "전환금액" |
| 2026-05-04 | refactor: `lib/security.ts` — deprecated 함수(canModifyBooking/canAccessContentPost/VALID_BOOKING_STATUSES/VALID_CONSULTATION_STATUSES/isValidBookingStatus/isValidConsultationStatus) 제거. `isValidPaymentAmount` → `isValidConversionAmount` 리네이밍 |
| 2026-05-04 | note: 전환 시점은 `leads.status_changed_at` 기준. 이 컬럼이 NULL인 레거시 데이터는 기간 필터에서 누락될 수 있음 (TODO: 백필 마이그레이션 후 제거) — 각 라우트 상단에 주석 명시 |

## Naver Search Ads 풀 동기화 구현 (2026-05-04)

| 날짜 | 내용 |
|------|------|
| 2026-05-04 | feat: Naver Search Ads 동기화 구현 (`lib/services/naverAds.ts`) — HMAC-SHA256 시그니처 인증, `fetchNaverAds`(캠페인 레벨 → ad_campaign_stats) + `fetchNaverAdStats`(ad 레벨 → ad_stats). 광고그룹·광고 순회 후 stats 청크 분할 호출 |
| 2026-05-04 | feat: `adSyncManager.ts`에 `naver_ads` case 추가 — 클라이언트별 설정/환경변수 폴백 양쪽 분기에 모두 반영 |
| 2026-05-04 | feat: `SYNC_ENABLED_PLATFORMS`에 `naver_ads` 추가 — Cron 자동 동기화 대상 포함 |
| 2026-05-04 | feat: `/api/admin/clients/[id]/api-configs/test` 라우트에 `testNaverAds` 구현 — `GET /ncc/campaigns` 호출로 인증 검증, 첫 캠페인명 또는 customer_id를 accountName으로 반환 |
| 2026-05-04 | feat: 환경변수 폴백 추가 — `NAVER_ADS_CUSTOMER_ID`, `NAVER_ADS_ACCESS_LICENSE`, `NAVER_ADS_SECRET_KEY` |

## 운영 배포 완료 — 견적/계산서 복원 및 거래처 동기화 (2026-04-16)

| 날짜 | 내용 |
|------|------|
| 2026-04-16 | feat: 견적/계산서(ERP) 기능 복원 — glitzy-web 연동, 견적서/계산서 탭 목록 조회, Sheet 상세, 승인/반려(사유 입력), `lib/services/erpClient.ts` 프록시 |
| 2026-04-16 | feat: 거래처 양방향 동기화 — webhook 수신(`/api/webhook/erp-client`), pull 조회(`/api/admin/erp-clients`), 일괄 동기화(`/api/admin/erp-clients/sync`) |
| 2026-04-16 | feat: `erp_client_id` TEXT(UUID) 타입 — clients 테이블에 glitzy-web 거래처 UUID 매핑 컬럼 추가 |
| 2026-04-16 | feat: `branch_name` 지점명 표시 — 거래처 목록/드롭다운에 지점명 표기 |
| 2026-04-16 | feat: 거래처 드롭다운 선택 + 자동채움 — 클라이언트 관리 페이지에서 ERP 거래처 검색·선택 시 정보 자동 입력 |
| 2026-04-16 | feat: 로그인 placeholder `01012345678` (하이픈 없음)으로 변경 |
| 2026-04-16 | Phase 0~6 구현 완료, 운영 가능 상태로 배포 |

## Demo Viewer 구현 (2026-04-16)

| 날짜 | 내용 |
|------|------|
| 2026-04-16 | feat: Demo Viewer 구현 — 로그인 페이지 "데모 체험하기" 버튼, demo_viewer 역할 인증/세션 처리, 모든 API에 완전한 fixture 데이터 반환 (대시보드 KPI/트렌드/퍼널/채널/예산, 광고 성과/소재/요일/효율/랜딩페이지, 캠페인, 고객관리 15명, 견적서 5건/계산서 4건), 읽기 전용 강제(POST/PUT/DELETE 차단), 데모 배너 UI, Sidebar admin 메뉴 숨김 |

## Agatha 전환 (2026-04-16)

| 날짜 | 내용 |
|------|------|
| 2026-04-16 | Samantha → Agatha 전환 완료: 브랜드명, 도메인 용어(Clinic→Client, Customer→Contact), 컬러(Blue→Slate+Violet), 폰트(Inter→Pretendard+Geist Mono), 라이트모드 기본 |
| 2026-04-16 | 삭제된 기능: MediChecker(의료광고 검증), 언론보도(press), ERP 연동, 챗봇, 예약/결제 관리(patients), 상담(consultations) |
| 2026-04-16 | 환경변수 정리: ANTHROPIC_API_KEY, OPENAI_API_KEY, NAVER_NEWS_*, ERP_*, EXTERNAL_SERVICE_KEY, Kakao 메시징 제거 |
| 2026-04-16 | CLAUDE.md 전면 재작성 (Agatha 기준), 하위 CLAUDE.md 업데이트, docs/BRAND.md Agatha 브랜드 가이드로 변경 |

## Samantha 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-19 | CLAUDE.md 재설계: 모듈 분리, 검증 루프, 도메인 용어, 네이밍 컨벤션, 팀 가이드 추가 |
| 2026-03-19 | 원격 변경 병합: ClinicContext, archive, error-alert, channel, date 유틸, deleted_records, E2E 상세 |
| 2026-03-19 | 검증 규칙에 '전체 맥락 코드 리뷰' 단계 추가 — 구현부만 단독 검토하지 않고 호출자/데이터 흐름/역할별/기존 패턴과의 정합성까지 확인 |
| 2026-03-19 | 디렉토리 구조에 공개 페이지(privacy, terms), 앱 아이콘(icon.tsx, apple-icon.tsx) 추가 |
| 2026-03-20 | 디렉토리 구조에 `components/ads/` 추가 — 광고 성과 페이지 3탭 구조 재구성 (4개 신규 API, 9개 신규 컴포넌트) |
| 2026-03-20 | 언론보도 다중 키워드 지원: `press_keywords` 테이블, 키워드 CRUD API, pressSync 다중 키워드 검색, clinic_staff 언론보도 접근 허용 |
| 2026-03-20 | 순위 모니터링 키워드 삭제 기능 추가 (DELETE API + AlertDialog UI) |
| 2026-03-20 | 언론보도 DateRangePicker 추가, Google News 검색 기간 제한(6개월) |
| 2026-03-20 | 광고 성과 날짜 포맷 불일치 수정: ISO→YYYY-MM-DD 통일, timestamptz KST 명시 (8개 API 파일) |
| 2026-03-23 | 예약/결제 관리 필터·정렬 추가: DateRangePicker, 상태/유입경로/결제 필터, SortSelect 공용 컴포넌트(`components/common/sort-select.tsx`) |
| 2026-03-23 | 캠페인 리드 필터·페이지네이션: 목록/상세 검색·채널·정렬, DateRangePicker, 50건 페이지네이션, `normalizeChannel` 재사용(`lib/channel.ts`) |
| 2026-03-23 | UI/UX 감사 P0~P3: `prefers-reduced-motion`, StatsCard/퍼널/상태배지 키보드 접근성, 하드코딩 hex→COLORS 상수, `text-[10px]`→`text-xs` 상향, `navLinkClass()` 추출, Firefox 스크롤바, transition `duration-200` 통일, `as any` 제거 |
| 2026-03-23 | 페이지별 브라우저 탭 제목: thin server layout.tsx 래퍼 패턴 (18개 페이지), `metadata.title.template` 설정 |
| 2026-03-23 | Samantha 브랜드: 서비스명 확정, 컬러 마이그레이션 Indigo→Blue (15개 파일), `docs/BRAND.md` 생성 |
| 2026-03-23 | agency_staff 메뉴 권한에 키워드 관리 항목 추가 |
| 2026-03-24 | glitzy-web ERP 연동 가이드 문서 추가 (`docs/INTEGRATION.md`): 견적서/계산서 읽기 전용 연동 설계 |
| 2026-03-24 | MediChecker 통합: 의료광고법 제56조 AI 검증 기능 (7단계 파이프라인, 5 DB 테이블, 3 API, 8 컴포넌트, 사이드바 메뉴) |
| 2026-03-24 | MediChecker UI/UX 감사: 2컬럼 레이아웃, 심각도 그룹핑, 컴팩트 카드, A11y 13건 수정, getRiskLevel 유틸 추출 |
| 2026-03-24 | 검증 규칙에 '문서 업데이트 필수' 단계 추가 — 코드 리뷰 완료 후 관련 문서(CLAUDE.md, API.md, COMPONENTS.md 등) 반드시 업데이트 |
| 2026-03-24 | MediChecker Phase 2: logActivity 연동 + 이력 상세 보기 |
| 2026-03-24 | MediChecker Phase 3: agency_staff 메뉴 권한에 `medichecker` 항목 추가 (MENU_OPTIONS) |
| 2026-03-24 | ERP 연동: glitzy-web 견적서/계산서 읽기 전용 프록시 (erpClient, API 2개, UI 2컴포넌트, Sheet 상세) |
| 2026-03-24 | ERP Phase 2: 견적서 승인/반려 (PATCH API, erpClient method/body 확장, Sheet 내 승인/반려 버튼, 반려 사유 다이얼로그) |
| 2026-03-24 | fix: 대시보드 퍼널 API `applyDateFilter` 날짜 이중 타임존 버그 수정 (전 단계 0명 표시) |
| 2026-03-26 | 광고 backfill API (`/api/admin/backfill-ads`): 특정 병원의 과거 광고 데이터 일괄 수집 (최대 90일, CRON_SECRET 인증) |
| 2026-03-26 | `sanitizeUrl()` 도입: URL용 sanitize 함수 추가 (`&` 보존, 위험 스킴 차단). `sanitizeString`이 URL의 `&`를 제거하여 CAPI event_source_url/DB inflow_url 깨지는 버그 수정 (6곳 교체) |
| 2026-03-26 | Ad 레벨 수집: `ad_stats` 테이블, `fetchMetaAdStats()` (페이지네이션+url_tags/effective_link→utm_content), 소재별 성과에 광고 지표(지출/노출/클릭/CPC/CTR/CPL) 통합, 캠페인 CPL ad_stats 경유 매칭 |
| 2026-03-26 | StatsCard 동적 폰트 크기: 값 길이에 따라 폰트 자동 축소 (`getValueSizeClass`), `truncate` 제거 → `break-all` 적용. 좁은 카드에서 금액 잘림 방지 |
| 2026-03-26 | DateRangePicker 개선: 시작일/종료일 명시 표시, 팝오버 상단 선택 상태, "이번 달" 프리셋, 캘린더 2개월 표시. 광고 성과 기본값 이번 달로 변경 |
| 2026-03-26 | fix: 캠페인 CPL + 소재별 광고 지표 — inflow_url utm_id 기반 매칭 (ads_read 권한 불필요), 날짜 표시 "최근 N일" → "M.D ~ M.D" 통일 |
| 2026-03-26 | 전체 프로젝트 감수 및 수정: (1) GAQL 쿼리 파라미터 인젝션 방어 (googleAds.ts), (2) `session?.user as any` 제거 14개 페이지, (3) 대시보드 API 인라인 `applyFilter` → 중앙 `applyClinicFilter`/`applyDateRange` 교체 6개 파일, (4) Recharts 툴팁 `any` → `ChartTooltipProps` 타입 적용 9개 컴포넌트 (`types/recharts.d.ts` 신규), (5) API try-catch 래핑 6개 파일, (6) `NextResponse.json` → `apiSuccess` 7개 API, (7) 차트 컬러 중앙화 `lib/chart-colors.ts` 신규 + 9개 컴포넌트 교체, (8) 다크모드 `--overlay` CSS 변수 도입 + 5개 UI 컴포넌트 적용, (9) 정렬 테이블 aria-sort/키보드 접근성 2개 컴포넌트, (10) 터치 타겟 44px 확대 3개 컴포넌트, (11) console.log → createLogger 1건, toISOString → getKstDateString 2건 |
| 2026-03-27 | 순위 모니터링 "함께많이찾는" 카테고리 추가: DB CHECK 제약조건 확장(`related`), API validCategories, UI 3개 페이지 CATEGORY_LABELS/LIST 업데이트 |
| 2026-03-30 | fix: 전체 프로젝트 KST 타임존 일관성 감사 및 수정 — (1) KPI API `split('T')[0]` UTC→KST 오변환 (`getKstDateString` 교체), (2) 콘텐츠 분석 `toISOString().slice(0,7)` UTC 월 오류 (`getKstDateString(toUtcDate())` 교체), (3) 순위입력 날짜 이동 타임존 미지정 (`+09:00` 추가), (4) stat_date `split('T')[0]` → `slice(0,10)` 정리 (2곳), (5) E2E 헬퍼 `toISOString()` → KST 변환. `toISOString().split('T')[0]` 패턴 프로젝트에서 완전 제거 |
| 2026-03-30 | TikTok Ads API 연동: (1) `data_level` 필수 파라미터 추가, (2) `fetchTikTokAdStats` ad 레벨 수집 신규 (ad_stats 저장), (3) 캠페인+ad 레벨 페이지네이션 공통 헬퍼 `fetchTikTokReport`, (4) adSyncManager Meta 동일 병렬 수집 구조, (5) 소재별 성과 API에 utm_content 없는 ad_stats(TikTok) ad_id 기준 표시, (6) 90일 backfill 완료 (clinic_id=20) |
| 2026-03-30 | 대시보드 재설계: (1) 기본 날짜 "오늘"→"이번 달", (2) KPI 6카드→5카드(광고비/리드+오늘/CPL/매출/ROAS), (3) 퍼널 5단계→3단계(리드→예약→결제)+인사이트, (4) TodaySummary/ChannelChart/CplRoasChart 제거, (5) RecentLeads 최근 8건 피드 신규, (6) ChannelTable 정렬 가능 테이블 신규(clicks/impressions/ctr 추가), (7) 채널 API에 clicks/impressions/ctr 필드 추가 |
| 2026-03-30 | 시스템 메뉴 토글: `system_settings` 테이블, 슈퍼어드민 설정 페이지(`/admin/settings`), 사이드바 동적 숨김 메뉴 로드. 하드코딩 `hidden` 플래그 → DB 기반 동적 제어로 전환 |
| 2026-03-30 | 광고 성과 3탭 지표 재배치: (1) 성과 개요: KPI 8→5카드(ROAS/전환율/CAC→매출귀속), 매체비교에 노출/클릭 추가+ROAS/전환율 제거, 퍼널 5→3단계(2-Zone+미니카드), LP분석→캠페인탭 이동 (2) 캠페인분석: LP분석 추가(mode prop delivery/full), 소재별 13→10컬럼(결제/전환율/매출 제거) (3) 매출귀속: KPI 3→6카드(ROAS/전환율/CAC 추가), 전환퍼널·채널별 매출비중·ROAS 추이·LP 전환 테이블 신규 |
| 2026-03-30 | 외부 API: `GET /api/external/ad-spend` — 병원별 월간 광고 실집행비(매체별) + SMS 발송 건수. `withExternalAuth` 미들웨어 신규 (`EXTERNAL_SERVICE_KEY` Bearer 인증). glitzy-web 결산용 |
| 2026-03-30 | 광고 성과 UI 개선: 퍼널 수직 스텝 카드, 소재별 성과 10건 페이지네이션, 캠페인 행 클릭→소재 필터링 |
| 2026-03-30 | 고객 여정 타임라인에서 챗봇 발송 단계 제거 |
| 2026-03-30 | fix: 고객 상세 모바일 Sheet 헤더 중복 제거 — SheetHeader `sr-only` + CustomerDetail `hideHeader` prop 추가 |
| 2026-03-30 | CLAUDE.md 재설계: 200줄 이내 압축, 변경 이력 `docs/CHANGELOG.md` 분리, 디렉토리 구조 압축, 팀 가이드 추가 |
| 2026-04-01 | 예약/결제 관리 DateRangePicker 미래 날짜 선택 허용 (`allowFuture` prop) |
| 2026-04-01 | 예약/결제 관리 DateRangePicker 예약 날짜 도트 표시 (`bookedDates` prop, `modifiers` 활용) |
| 2026-04-01 | 예약/결제 관리 캘린더 드래그앤드롭: `@dnd-kit/core` 도입, 월간/주간/일간 뷰에서 예약 카드 드래그→날짜/시간 변경 (확인 다이얼로그, cancelled/noshow 드래그 비활성화) |
| 2026-04-01 | 캘린더 UX 개선: 일간 뷰 10분 단위 슬롯(10:00~19:50), 현재 시간 빨간 구분선+자동 스크롤, 월간/주간 뷰 전체 예약 표시(slice 제한 제거), 취소/노쇼 취소선+투명도 시각 구분, DragOverlay/확인 다이얼로그 디자인 개선 |
| 2026-04-07 | fix: 시술별 매출 비중 KPI 매출 불일치 수정 — leads 간접 조회(200건 제한)에서 payments 직접 조회로 변경 (`/api/dashboard/treatment-revenue` 신규) |
| 2026-04-07 | feat: 광고 플랫폼 2계층 구조 도입 — `lib/platform.ts` 중앙 상수, campaign_type 컬럼 추가, platform 값 `meta_ads` 형식 통일, Naver/Kakao/Dable 신규 플랫폼 API 설정 UI |
| 2026-04-13 | feat: 랜딩페이지 제출 후 리다이렉트 URL 설정 — `landing_pages.redirect_url` 컬럼 추가, 관리 페이지 입력란, `/api/lp/render`에서 `__LP_DATA__.redirectUrl` 주입 후 폼 제출 성공 시 `location.href` 이동 (HTML 파일 무수정) |
| 2026-04-13 | feat: Demo 모드 (`demo_viewer` role) — 영업/영상 촬영용 실데이터 무결성 보장 샌드박스. 4겹 방어(role / 화이트리스트 미들웨어 / API 래퍼 / 핸들러 분기), `/demo/enter?key=<DEMO_ACCESS_KEY>` 진입 + `/demo/exit` 퇴장, `lib/demo/fixtures/` (병원 6개 × 12개월 deterministic 광고 데이터 + 에피소드), 18개 GET API fixture 분기, 모든 Write 405 차단, Cron/동기화 접근 불가, `DemoBadge` UI, `scripts/seed-demo-user.ts` |
