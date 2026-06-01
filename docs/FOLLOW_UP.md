# 후속 작업 백로그 (2026-06-01 아키텍처 리뷰 기준)

`improve-codebase-architecture` 리뷰 + ADN 데이터 진단 세션에서 도출된 남은 작업.
이미 처리한 것은 `docs/CHANGELOG.md`(2026-06-01 항목들) 참조. 아래는 **미처리** 항목만.

## 🔴 판단/운영 조치 필요 (방치 시 사용자 영향)

- [ ] **인입 정의 불일치 — `cron/send-reports` vs `dashboard/kpi`**
  - 현상: combined 매체(Meta 등)에서 **대시보드 KPI 총 인입과 SMS 리포트 총 인입이 달라질 수 있음**.
    - `dashboard/kpi`: combined 매체의 매체전환을 리드에 **더함**(채널별 뷰와 동일).
    - `cron/send-reports`: combined 매체전환을 **제외**(리드가 actualLeads 에 이미 포함 → 글로벌 중복제거).
  - 필요한 결정(제품): combined 매체에서 "리드"와 "매체전환"이 같은 사람인가/다른 사람인가 → 같은 정의로 통일.
  - 위치: `app/api/cron/send-reports/route.ts:~115` (의도적으로 `countsMediaConversions` 미적용), `app/api/dashboard/kpi/route.ts`.

- [ ] **ADN 5/23·5/24 재백필** (미완 시)
  - 현상: 봉명동내커피 ADN 비용/노출/클릭이 실제보다 ~6% 적게 표시(정확히 5/23·5/24 두 날 누락). API엔 데이터 존재.
  - 조치: `POST /api/admin/backfill-ads` `{clientId, startDate:"2026-05-23", endDate:"2026-05-24", platforms:["adn_ads"]}` (멱등).

- [ ] **ADN DB전환(예: 5월 18건) 자동 수집 불가**
  - 사실: ADN 리포트 API(`across_adn_api_report.php`)는 전환 6필드(conv_cnt/conv_price/direct·indirect)를 주지만 5월 내내 전부 0. "DB전환"은 **API에 필드 자체가 없음**(관리화면 전용).
  - 현재: `manual_inflows` 수동 보정으로만 반영.
  - 자동화 경로: (a) acrosspf 전환/DB 전용 API 문서 확보 시 `lib/services/adnAds.ts` 연동, 또는 (b) ADN 광고를 Agatha 랜딩페이지로 연결해 리드(utm_source=adn)로 트래킹 → `combined` 모드가 자동 합산.

- [ ] **노출된 ADN API 키 재발급(rotate)** — 진단 중 평문 노출됨. acrosspf 재발급 후 `client_api_configs` / `ADN_ADS_API_KEY` 갱신.

## ⚠️ 남겨도 되나 추적 권장 (잠재 리스크)

- [ ] **멀티테넌트 격리 — 구조화**
  - 현재 누출 없음(2026-06-01 전수 감사 PASS). 단 격리가 "라우트마다 `applyClientFilter` 호출 기억"에 의존 → 새 라우트가 깜빡하면 미래 누출 가능.
  - 안전 옵션: **CI/lint 가드**(테넌트 테이블 `.from()` 호출 시 `applyClientFilter`/명시적 client_id 없으면 경고). 또는 테넌트 스코프 accessor(아래 #3).
  - 메모: `lp/meta`(숫자 PK 열거 시 페이지 *이름*만 노출, 민감도 낮음), 중첩 `leads(...)` 조인(lead.client_id == contact.client_id 무결성에 의존) — 둘 다 현재 누출 아님.

## ✅ 무기한 보류 안전 (기능 결함 아님 — 테스트 가능 환경에서 진행 권장)

> 모두 매출/동기화 런타임 동작을 바꾸므로, 실 자격증명·DB 로 검증 가능한 환경(스테이징/테스트 하네스)에서 할 것. 블라인드 진행 금지.

- [ ] **#1 광고 동기화 deepening (깊은 부분)** — `metaAds/googleAds/tiktokAds/naverAds/adnAds` + `adSyncManager` 의 5중 switch·fetch 흐름을 **PlatformFetcher 어댑터 seam**(어댑터=rows 반환+자격증명 소유, 오케스트레이터=upsert 1벌)으로 collapse. strangler 방식(ADN 등 단순 매체부터 한 매체씩). ※ 이미 한 안전 슬라이스: `lib/services/ad-upsert.ts`(onConflict 단일화).
- [ ] **#3 테넌트 스코프 accessor** — `applyClientFilter` 를 매번 기억하는 대신, client_id 를 내부 적용하는 단일 accessor 가 테넌트 테이블 유일 출입구가 되게. ~20 라우트, 보안 직결 → 라우트별 검증 필수.
- [ ] **#4 `useClientData` 점진 확장** — 나머지 컴포넌트(ads/*, customers/lead-tab, erp-documents/* 등)를 `hooks/use-client-data.ts` 로 흡수(opt-in). seam 정착 후 재시도/타임아웃을 한 곳(fetchJSON)에서 상향 가능.
- [ ] **#5 inflow_source override 설정 UI** — `fetchInflowOverrides` 배선은 완료(휴면). API 설정 다이얼로그에 inflow_source 입력란 추가하면 클라이언트별 override 활성화.

## 참고
- 아키텍처 리뷰 HTML 리포트는 OS 임시 디렉토리에 생성됨(휘발성). 후보 5개 = 위 #1, 인입 deepening(#2 — 일부 완료), #3, #4, 클라이언트 재집계 제거.
- 2026-06-01 완료분: client_id 검증 강화 / 캠페인 복합키 / inflow_source 배선 / 인입 게이트 술어 단일화 / useClientData 도입 / onConflict 단일화 (CHANGELOG 참조).
