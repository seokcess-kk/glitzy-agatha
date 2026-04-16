# 변경 이력 (CLAUDE.md)

규칙 추가/수정 시 날짜와 사유를 기록. 불필요해진 규칙은 삭제하되 이력에 사유 남길 것.

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
