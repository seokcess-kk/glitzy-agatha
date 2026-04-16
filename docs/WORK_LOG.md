# Agatha 프로젝트 작업 로그

## 개요

마케팅 인텔리전스 SaaS 대시보드 개발 작업 기록.
각 Phase별 상세 내용은 하위 파일 참조.

---

## Demo Viewer (2026-04-16)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| D-1 | Demo Viewer 구현 | demo_viewer 역할 인증, fixture 데이터, 읽기 전용, 데모 배너 | 04-16 |

---

## Agatha 전환 작업 (2026-04-16)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| A-1 | Samantha → Agatha 전환 | 브랜드명, 도메인 용어, 컬러/폰트, 라이트모드 기본 전환 | 04-16 |
| A-2 | 기능 삭제 | MediChecker, 언론보도, ERP 연동, 챗봇, 예약/결제, 상담 제거 | 04-16 |
| A-3 | 환경변수 정리 | 불필요 API 키 검증 제거 (AI, News, ERP, Kakao) | 04-16 |
| A-4 | CLAUDE.md 재작성 | 메인 + 하위 3개 파일 Agatha 기준 전면 재작성 | 04-16 |
| A-5 | docs 정리 | BRAND.md, CHANGELOG.md, WORK_LOG.md Agatha 기준 업데이트 | 04-16 |

---

## Samantha 시기 전체 요약

| 단계 | 기간 | 주요 작업 | 상태 | 상세 |
|------|------|----------|------|------|
| Phase 1: 초기 설정 | ~2026-03-14 | shadcn/ui, 접근성, 번들 최적화, 문서화 (Phase 1~9) | 완료 | [상세](work-log/phase1-setup.md) |
| Phase 2: 핵심 기능 | 2026-03-14~16 | KPI, UTM, 랜딩, 소재, 어드민 분리, 리드 필터 (P2~P12) | 완료 | [상세](work-log/phase2-features.md) |
| Phase 3: 운영 기능 | 2026-03-16~ | 캠페인, 알림, 상태관리, 예약 등록, UTM 개편 (P13~P17) | 완료 | [상세](work-log/phase3-operations.md) |
| Phase 4: 모니터링 + 역할 | 2026-03-16~ | 순위 모니터링, agency_staff 역할, 메뉴 권한 (P18) | 완료 | [상세](work-log/phase4-monitoring.md) |
| E2E 테스트 | 2026-03-16 | Playwright 106개 테스트 | 완료 | [상세](work-log/e2e-tests.md) |
| Phase 5: 대시보드 고도화 | 2026-03-17~18 | KPI 재구성, 오늘 요약, 듀얼 차트, 채널 바차트, 퍼널 분리 | 완료 | [상세](work-log/phase5-dashboard-overhaul.md) |
| Phase 6: 광고 성과 고도화 | 2026-03-19 | 소재 분석, 이상치 알림, CSV 내보내기, 주간 리포트, 멀티터치 어트리뷰션 | 완료 | [상세](work-log/phase6-ads-enhancement.md) |
| Phase 7: 병원별 API 키 관리 | 2026-03-19 | 매체별 API 키 CRUD, 연결 테스트, 암호화 저장, 동기화 리팩토링 | 완료 | [상세](plans/PLAN_clinic-api-configs.md) |
| Phase 8: 법적 페이지 + 앱 아이콘 | 2026-03-19 | 개인정보처리방침, 서비스약관 페이지, 앱 아이콘 생성, 로그인 푸터 링크 | 완료 | - |
| Phase 9: 광고 성과 재구성 | 2026-03-20 | /ads 페이지 3탭 구조, 4개 신규 API, 9개 신규 컴포넌트, 효율 기반 인사이트 | 완료 | - |
| Phase 10: 개선 + 버그 수정 | 2026-03-20 | 언론보도 기간 필터, 광고 날짜 버그 수정, 예약 유입 경로 표시 | 완료 | - |
| Phase 11: 예약/결제 필터·정렬 | 2026-03-23 | 기간·상태·유입경로·결제 필터, 정렬, SortSelect 공용 컴포넌트 | 완료 | - |
| Phase 12: 캠페인 리드 필터·페이지네이션 | 2026-03-23 | 캠페인 목록/상세 검색·채널·정렬·DateRangePicker·50건 페이지네이션 | 완료 | - |
| Phase 13: UI/UX 감사 + Polish | 2026-03-23 | 접근성(A11y), 색상 토큰화, 타이포 상향, 반응형, 코드품질, LP 분석 분리 | 완료 | - |
| Phase 14: MediChecker 통합 | 2026-03-24 | 의료광고법 제56조 AI 검증 (7단계 파이프라인, RAG, 온톨로지) | 완료 | - |
| Phase 14b: MediChecker UI/UX 감사 | 2026-03-24 | 2컬럼 sticky 레이아웃, 심각도 그룹핑, 컴팩트 카드, A11y 13건 수정 | 완료 | - |
| Phase 15: ERP 연동 | 2026-03-24 | glitzy-web 견적서/계산서 읽기 전용 프록시, Sheet 상세, 탭 UI, 견적 승인/반려 | 완료 | - |
| 버그 수정 | 2026-03-24 | 대시보드 퍼널 날짜 이중 타임존 버그 수정 (전 단계 0명 표시) | 완료 | - |
| Phase 16: Ad 레벨 수집 + Backfill | 2026-03-26 | ad_stats 테이블, Ad 레벨 수집(fetchMetaAdStats), 소재/캠페인 지표 통합, backfill API, sanitizeUrl | 완료 | - |
| Phase 17: 대시보드 재설계 + TikTok + 감사 | 2026-03-27~30 | KST 감사, TikTok ad 레벨, 대시보드 4섹션, 메뉴 토글, 광고 3탭 재배치, 외부 API | 완료 | - |
| Phase 18: 예약 캘린더 DnD + UX | 2026-04-01 | @dnd-kit 드래그앤드롭, 미래 날짜 허용, 도트 표시, 10분 슬롯, 시간 구분선 | 완료 | - |
| 버그 수정 | 2026-03-30~04-01 | 랜딩페이지 Storage upsert, privacy/terms 미인증 접근, 탭 타이틀, 로그인 링크 | 완료 | - |

---

## 최신 작업 (Phase 18: 예약 캘린더 DnD + UX)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P33-1 | 미래 날짜 허용 | DateRangePicker `allowFuture` prop 추가, 예약/결제 관리에서 미래 날짜 선택 가능 | 04-01 |
| P33-2 | 예약 도트 표시 | DateRangePicker `bookedDates` prop + `modifiers` 활용, 예약 있는 날짜에 도트 표시 | 04-01 |
| P33-3 | 드래그앤드롭 | `@dnd-kit/core` 도입, DraggableBooking/DroppableCell 컴포넌트, 월간/주간/일간 뷰 드래그→날짜/시간 변경 | 04-01 |
| P33-4 | 드래그 제약 | cancelled/noshow 상태 드래그 비활성화, 확인 다이얼로그, DragOverlay 디자인 | 04-01 |
| P33-5 | 일간 뷰 개선 | 10분 단위 슬롯(10:00~19:50), 현재 시간 빨간 구분선+자동 스크롤 | 04-01 |
| P33-6 | 전체 예약 표시 | 월간/주간 뷰 slice 제한 제거, 취소/노쇼 취소선+투명도 시각 구분 | 04-01 |

---

## 이전 최신 작업 (Phase 17: 대시보드 재설계 + TikTok + 감사)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P32-1 | KST 타임존 감사 | `split('T')[0]`/`toISOString().slice(0,7)` 패턴 전체 제거, KST 변환 일괄 적용 (5곳) | 03-30 |
| P32-2 | TikTok ad 레벨 | `fetchTikTokAdStats` + `fetchTikTokReport` 공통 헬퍼, ad_stats 저장, 소재별 성과 TikTok 표시 | 03-30 |
| P32-3 | 대시보드 재설계 | KPI 5카드, 퍼널 3단계+인사이트, RecentLeads 8건, ChannelTable 정렬(clicks/impressions/ctr) | 03-30 |
| P32-4 | 시스템 메뉴 토글 | `system_settings` 테이블, `/admin/settings` 페이지, 사이드바 동적 숨김 | 03-30 |
| P32-5 | 광고 성과 3탭 재배치 | 성과 개요 KPI 5카드+퍼널 3단계, 캠페인에 LP분석 이동, 매출귀속 KPI 6카드+4신규 섹션 | 03-30 |
| P32-6 | 외부 API | `GET /api/external/ad-spend` — 월간 광고비+SMS, `withExternalAuth` 미들웨어 | 03-30 |
| P32-7 | 광고 UI 개선 | 퍼널 수직 스텝 카드, 소재 10건 페이지네이션, 캠페인→소재 필터링 | 03-30 |
| P32-8 | 순위 모니터링 | "함께많이찾는" 카테고리 추가 (DB CHECK, API, UI 3페이지) | 03-27 |

---

## 이전 작업 (Phase 16: Ad 레벨 수집 + Backfill)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P31-1 | Backfill API | `POST /api/admin/backfill-ads` — CRON_SECRET 인증, 최대 90일 | 03-26 |
| P31-2 | sanitizeUrl 도입 | `lib/security.ts`에 `sanitizeUrl()` — URL `&` 보존 | 03-26 |
| P31-3 | ad_stats + Ad 수집 | `ad_stats` 테이블, `fetchMetaAdStats()`, 소재/캠페인 지표 통합, CPL | 03-26 |

---

## 이전 작업 (Phase 15: ERP 연동)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P30-1 | 타입 + 환경변수 | `types/erp.ts` 타입 정의, `lib/env.ts`에 ERP 그룹 추가 | 03-24 |
| P30-2 | ERP 클라이언트 | `lib/services/erpClient.ts` — fetchJSON 기반 4개 함수 (quotes/invoices 목록+상세) | 03-24 |
| P30-3 | API 라우트 | `/api/erp-documents` 목록 + `/api/erp-documents/[id]` 상세 (UUID 검증, clinic_staff 차단) | 03-24 |
| P30-4 | 프론트엔드 | 견적서/계산서 탭 페이지 + quote-list/invoice-list 컴포넌트 + Sheet 상세 | 03-24 |
| P30-5 | 사이드바 | 견적/계산서 메뉴 추가 (Receipt 아이콘, minRole: 2, menuKey: erp-documents) | 03-24 |
| P30-6 | 문서 수정 | INTEGRATION.md 스펙 오류 3건 수정 (fetchJSON, clinic_staff 차단, UUID ID) | 03-24 |
| P30-7 | 견적 승인/반려 | `erpClient.respondToQuote()`, PATCH API, quote-list 승인/반려 버튼 + 반려 사유 다이얼로그 | 03-24 |
| P30-8 | 퍼널 버그 수정 | `funnel/route.ts` `applyDateFilter`에서 ISO 날짜에 타임존 이중 적용 → 쿼리 결과 0건 버그 수정 | 03-24 |

---

## Phase 14b (MediChecker UI/UX 감사)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P29b-1 | 레이아웃 개선 | 검증 전/후 UI 분리, 데스크톱 2컬럼(좌: 원문 max-height, 우: 위반 스크롤), 모바일 스택 | 03-24 |
| P29b-2 | 위반 카드 압축 | 컴팩트 기본(번호+타입+법조문+위반텍스트+제안 1줄), 확장 시 상세. 심각도별 3그룹(높음/주의/참고) | 03-24 |
| P29b-3 | 접근성 수정 | textarea label 연결, ViolationCard 이중 인터랙티브 해소, focus-visible 추가, aria-label/aria-pressed | 03-24 |
| P29b-4 | 코드품질 | getRiskLevel 유틸 추출(3파일 중복 제거), indexOf→Map, unused ref 제거, import 정리 | 03-24 |
| P29b-5 | UX 개선 | 클립보드 실패 toast, 면책 조항 opacity 제거, sticky→max-height(overflow 컨테이너 대응) | 03-24 |
| P29b-6 | logActivity 연동 | verify route에서 mc_verification_logs INSERT 후 activity_logs에 기록 | 03-24 |
| P29b-7 | 이력 상세 보기 | HistoryTable에서 클릭 → /api/medichecker/history/[id] → 결과 UI에 로드 (isFromHistory 표시) | 03-24 |

---

## Phase 14 (MediChecker 통합)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P29-1 | DB 마이그레이션 | `mc_law_articles`, `mc_procedures`, `mc_relations`, `mc_chunks`, `mc_verification_logs` 5개 테이블 + pgvector/pg_trgm 함수 3개 | 03-24 |
| P29-2 | 도메인 서비스 | `lib/medichecker/` 12개 파일: types, prompts(4), embedding, claude-client, rag, ontology, analysis, highlight, verification | 03-24 |
| P29-3 | API 라우트 | SSE 스트리밍 검증 (`/api/medichecker/verify`), 이력 목록/상세 (`/api/medichecker/history`) | 03-24 |
| P29-4 | 프론트엔드 | `useVerification` SSE 훅, 8개 컴포넌트 (text-input-card, ad-type-selector, verify-progress, result-kpi-cards, violation-card, violation-highlight, history-table), 메인 페이지 | 03-24 |
| P29-5 | 사이드바 | "원고 검수" 메뉴 그룹 추가 (ShieldCheck 아이콘, minRole: 2, menuKey: medichecker) | 03-24 |
| P29-6 | 코드 리뷰 수정 | RPC 시그니처 3개 일치, HistoryTable 응답 매핑, SSE 이벤트 구조, confidence 범위 0-100 통일, clinic_staff API 차단 | 03-24 |
| P29-7 | 시드 데이터 | `data/medichecker-seed/` JSON 6개 파일 (법조문 15건, 시술 50건, 관계 ~100건, 청크 ~46건) | 03-24 |
| P29-8 | 환경변수 | `OPENAI_API_KEY` AI 그룹에 추가, `@anthropic-ai/sdk` + `openai` 의존성 추가 | 03-24 |

---

## Phase 13 (UI/UX 감사 + Polish)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P28-1 | 접근성 (P0) | `prefers-reduced-motion` 지원, StatsCard 키보드 접근성(`role/tabIndex/onKeyDown`), 퍼널 노드 클릭 토글 툴팁(모바일 접근), Sidebar `Image`→`ImageIcon` alias | 03-23 |
| P28-2 | 색상/타이포 (P1) | 퍼널 하드코딩 hex→COLORS 상수 추출, `text-[10px]`/`text-[11px]`→`text-xs` 상향 (6개 컴포넌트), 차트 축 폰트 11px | 03-23 |
| P28-3 | 반응형/UX (P2) | KPI 모바일 `gap-2`→`gap-3`, DateRangePicker 프리셋 `h-7`→`h-8`, 모바일 차트 인라인 범례 추가, 오버레이 transition 타이밍 통일 | 03-23 |
| P28-4 | 코드품질 (P3) | `navLinkClass()` 추출(Sidebar 9곳 중복 제거), Firefox `scrollbar-width` 지원, Kakao 배지 대비 `text-yellow-800` | 03-23 |
| P28-5 | Polish 최종 | 캠페인 상태 배지 키보드 접근성, `session?.user as any` 제거, CPL/ROAS `any`→인터페이스, transition `duration-200` 통일 | 03-23 |
| P28-6 | LP 분석 분리 | 광고 성과 LP 분석 컴포넌트 분리(`landing-page-analysis.tsx`, `landing-page-channel-breakdown.tsx`, `landing-page-trend-chart.tsx`, API route) | 03-23 |

---

## Phase 12 (캠페인 리드 필터·정렬·페이지네이션)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P27-1 | 캠페인 목록 필터 | 캠페인명 검색, 동적 채널 필터(normalizeChannel 재사용), 정렬(최신/리드/오늘유입/이름순), 요약 카드 필터 연동 | 03-23 |
| P27-2 | 캠페인 상세 필터 | DateRangePicker, 이름/전화번호 검색, 동적 채널 필터, 정렬(최신/오래된/이름순) | 03-23 |
| P27-3 | 클라이언트 페이지네이션 | 50건 단위 페이지네이션, ellipsis 페이지 번호, safePage 범위 초과 방지, 결과 건수 표시 | 03-23 |
| P27-4 | 상태 배지 필터 연동 | filteredForStatus(상태 제외 카운트)와 filtered(전체 필터) 분리, 필터 변경 시 1페이지 리셋 | 03-23 |
| P27-5 | 코드 리뷰 이슈 수정 | normalizeChannel 중복→lib/channel.ts 재사용, 정적→동적 채널 옵션, safePage 도입 | 03-23 |

---

## Phase 11 (예약/결제 관리 필터·정렬 개선)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P26-1 | 예약/결제 필터 바 | DateRangePicker(기본 30일), 상태·유입경로·결제 여부 필터, 필터 초기화, 결과 건수 표시 | 03-23 |
| P26-2 | 정렬 기능 | 최신순/오래된순/이름순/결제액순 정렬, SortSelect 공용 컴포넌트 추출(`components/common/sort-select.tsx`) | 03-23 |
| P26-3 | 통계·캘린더 필터 반영 | 통계 카드가 필터 결과 기준 집계, 캘린더 뷰에 상태·유입경로·결제 필터 반영 | 03-23 |

---

## Phase 10 (언론보도 개선 + 광고 성과 버그 수정 + 예약 유입 경로)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P25-1 | 언론보도 기간 필터 | DateRangePicker 추가 (기본 90일), API에 from/to 날짜 파라미터 지원 (KST 기준) | 03-20 |
| P25-2 | 뉴스 검색 기간 제한 | Google News RSS에 `when:6m` 추가, 6개월 이상 오래된 기사 수집 차단 | 03-20 |
| P25-3 | 광고 성과 날짜 포맷 수정 | `stat_date`(YYYY-MM-DD)와 ISO 형식 비교로 모든 광고 데이터가 필터링되던 **치명적 버그** 수정. 페이지→API 날짜를 YYYY-MM-DD로 통일, timestamptz 비교 시 KST 타임존 명시. 영향 범위: ads/page, stats, efficiency-trend, platform-summary, day-analysis, landing-page-performance, dashboard/kpi, dashboard/funnel (8개 파일) | 03-20 |
| P25-4 | 예약 목록 유입 경로 표시 | API에 `leads(utm_source, utm_campaign)` 조인 추가, ChannelBadge + 캠페인명 컬럼 표시, `first_source` 폴백 | 03-20 |
| P25-5 | 단위 테스트 인프라 | Jest + next/jest 설정, 4개 테스트 파일(security/channel/utm/date), 53개 테스트 | 03-20 |
| P25-6 | Web Vitals 모니터링 | `useReportWebVitals` 기반 성능 측정, dev 콘솔 출력 + prod poor 등급 서버 로깅 | 03-20 |

---

## Phase 9 작업 (광고 성과 페이지 전면 재구성)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P24-1 | KPI API 확장 | `kpi/route.ts`에 clicks/impressions/cpc/ctr 추가, comparison에도 반영 | 03-20 |
| P24-2 | 효율 추이 API | `/api/ads/efficiency-trend` — 일별 CPL·CPC·CTR 시계열 데이터 | 03-20 |
| P24-3 | 매체별 비교 API | `/api/ads/platform-summary` — 채널별 spend/clicks/leads/revenue/ROAS 종합 | 03-20 |
| P24-4 | 요일별 분석 API | `/api/ads/day-analysis` — KST 요일별 리드·광고비·CPL | 03-20 |
| P24-5 | 랜딩페이지 성과 API | `/api/ads/landing-page-performance` — LP별 리드→결제 전환율·매출 | 03-20 |
| P24-6 | KPI 카드 8종 | CPL/CPC/CAC 역전 trend 로직, 전기 대비 변화율 표시 | 03-20 |
| P24-7 | 효율 추이 차트 | ComposedChart 이중 Y축 (₩/%), CPL Area + CPC/CTR Line | 03-20 |
| P24-8 | 매체별 성과 테이블 | 최저 CPL 하이라이트, ROAS 색상 분기, 인사이트 텍스트 | 03-20 |
| P24-9 | 광고 퍼널 | 노출→클릭→리드→예약→결제 5단계, 최대 이탈 구간 하이라이트 | 03-20 |
| P24-10 | 캠페인 순위 테이블 | 헤더 클릭 정렬, CPC 상태 표시(🟢🟡🔴), 검색/페이지네이션 | 03-20 |
| P24-11 | 요일별 바 차트 | 7칼럼 BarChart, 최다 리드 요일 강조, CPL 라벨 | 03-20 |
| P24-12 | 랜딩페이지 테이블 | LP별 전환율·매출, 활성/비활성 상태 표시 | 03-20 |
| P24-13 | 3탭 페이지 조립 | 성과 개요 / 캠페인 분석 / 매출 귀속, URL 파라미터 동기화, refreshKey 패턴 | 03-20 |

---

## Phase 8 작업 (법적 페이지 + 앱 아이콘)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P23-1 | 개인정보처리방침 | `/privacy` 공개 페이지 (9개 조항: 처리 목적, 수집 항목, 보유 기간, 안전성 확보 등) | 03-19 |
| P23-2 | 서비스 이용약관 | `/terms` 공개 페이지 (11개 조항 + 부칙: 정의, 서비스 제공, 계정 관리, 데이터 관리 등) | 03-19 |
| P23-3 | 앱 아이콘 | `app/icon.tsx` (1024x1024) + `app/apple-icon.tsx` (180x180), Edge Runtime, 브랜드 그라데이션 + Activity 아이콘 | 03-19 |
| P23-4 | 로그인 푸터 링크 | 로그인 페이지 하단에 개인정보처리방침·서비스약관 링크 추가 | 03-19 |

---

## Phase 7 작업 (병원별 API 키 관리)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P22-0 | 사전 확인 | Supabase 스키마 확인: clinic_api_configs 존재(ALTER TABLE), ad_campaign_stats UNIQUE 변경 안전 | 03-19 |
| P22-1 | DB + 암호화 | 마이그레이션 2개(컬럼 추가 + UNIQUE 변경) + AES-256-GCM 암호화 유틸 | 03-19 |
| P22-2 | 관리 API | 매체별 API 키 CRUD + Meta/Google/TikTok 연결 테스트 API | 03-19 |
| P22-3 | 관리 UI | ClinicApiConfigDialog (매체 탭, 토큰 마스킹, 연결 테스트, 활성화 토글) | 03-19 |
| P22-4 | 동기화 리팩토링 | adSyncManager 오케스트레이터, 서비스 options 패턴, Cron maxDuration 300, stats clinic_id 필터 | 03-19 |
| P22-5 | 연동 테스트 | 마이그레이션 실행, JSONB 이중 인코딩 버그 수정, Meta 토큰 저장/복호화 정상 확인 | 03-19 |

> 상세 구현 계획: [PLAN_clinic-api-configs.md](plans/PLAN_clinic-api-configs.md)
> 잔여: Meta 토큰 발급 이슈 (앱 연결/권한 재확인 필요, Samantha 시스템 문제 아님)

---

## Phase 6 작업 (광고 성과 고도화)


| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P21-1 | 소재별 성과 API | utm_content 기반 소재별 리드/결제/전환율 집계 API | 03-19 |
| P21-2 | 소재별 성과 UI | 상위 5개 바차트 + 성과 테이블, /ads 페이지에 섹션 추가 | 03-19 |
| P21-3 | 이상치 알림 | CTR 급락/지출 급증 감지 → 관리자 SMS, sync-ads cron에 통합 | 03-19 |
| P21-4 | CSV 내보내기 | 퍼널단계/채널별 고객 CSV 다운로드, /leads 페이지에 버튼 추가 | 03-19 |
| P21-5 | 주간 리포트 집계 | 병원별 주간 성과(리드/예약/매출/광고) 집계 + SMS 요약 텍스트 | 03-19 |
| P21-6 | 주간 리포트 발송 | 매주 월요일 09:00 KST cron, notify_phones SMS 발송 | 03-19 |
| P21-7 | 멀티터치 어트리뷰션 | first/linear/time-decay 3종 모델, 매출 귀속 탭에 모델 선택 UI | 03-19 |

> 상세 구현 계획: [PLAN_phase6-ads-enhancement.md](plans/PLAN_phase6-ads-enhancement.md)

---

## Phase 5 작업 (대시보드 고도화)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P20 | KST 타임존 전환 | 전체 프로젝트 시간 표기를 UTC → KST(Asia/Seoul) 기준으로 통일 | 03-18 |
| P19-1 | 공용 인프라 | 채널 색상 유틸, StatsCard 개선 | 03-17 |
| P19-2A | KPI API 개선 | 오늘 요약, comparison 확장, Trend 리드 추가 | 03-17 |
| P19-2B | 상단 섹션 컴포넌트 | TodaySummary, KpiSection, SpendLeadTrend | 03-17 |
| P19-2C | 하단 섹션 컴포넌트 | ChannelChart, TreatmentPie, FunnelSection | 03-17 |

> 상세 구현 계획: [PLAN_dashboard-overhaul.md](plans/PLAN_dashboard-overhaul.md)

---

## Phase 4 작업

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P18 | 순위 모니터링 + agency_staff | DB 4테이블, agency_staff 역할, 메뉴 권한, 순위 CRUD, 월간 테이블+차트 | 03-16 |

## Phase 3 작업

| # | 작업 | 핵심 내용 | 커밋 | 날짜 |
|---|------|----------|------|------|
| P13 | 캠페인별 리드 뷰 | 캠페인 카드 목록 → 리드 상세, 설문 응답 인라인 표시 | 96f7166 | 03-16 |
| P14 | 담당자 SMS 알림 | 솔라피 SMS, 병원별 알림 설정, non-blocking 발송 | 2f51711 | 03-16 |
| P15 | 리드 상태/메모 | 6개 상태 관리, 예약완료 시 bookings 자동 생성, 메모 연동 | 83de85a | 03-16 |
| P16 | 예약 등록 | 예약/결제 페이지에서 직접 등록, 고객 자동 생성 | de204a4 | 03-16 |
| P17 | UTM 페이지 개편 | 목록 + 생성기 모드 분리 | 74760a9 | 03-16 |

---

## DB 마이그레이션 현황

| 파일 | 내용 | 실행 필요 |
|------|------|----------|
| `20240101_add_utm_fields.sql` | leads UTM 필드 추가 | ⚠️ |
| `20240315_utm_templates_links.sql` | utm_templates, utm_links 테이블 | ⚠️ |
| `20260315_landing_pages.sql` | landing_pages 테이블, leads 컬럼 추가 | ⚠️ |
| `20260315_ad_creatives.sql` | ad_creatives 테이블 | ⚠️ |
| `20260315_ad_creatives_utm.sql` | ad_creatives UTM 컬럼 추가 | ⚠️ |
| `20260316_clinic_notify.sql` | clinics 알림 컬럼 추가 | ⚠️ |
| `20260316_lead_status.sql` | leads 상태/타임스탬프 컬럼 추가 | ⚠️ |
| `20260316_lead_notes.sql` | leads 메모 컬럼 추가 | ⚠️ |
| `20260316_landing_pages_random_id.sql` | landing_pages ID 8자리 랜덤으로 변경 | ⚠️ |
| `20260316_leads_landing_page_on_delete.sql` | leads FK ON DELETE SET NULL 추가 | ⚠️ |
| `20260316_lead_raw_logs.sql` | 리드 원본 로그 테이블 (유실 방지) | ⚠️ |
| `20260316_clinic_notify_phones.sql` | 병원 알림 연락처 최대 3개 (TEXT[]) | ⚠️ |
| `20260316_sms_send_logs.sql` | SMS 발송 로그 테이블 | ⚠️ |
| `20260316_clinic_staff_activity.sql` | 활동 추적 컬럼 + activity_logs 테이블 | ⚠️ |
| `20260316_monitoring_agency.sql` | agency_staff 배정/권한 + 모니터링 키워드/순위 테이블 | ⚠️ |
| `20260324_add_medichecker.sql` | MediChecker 5테이블 + pgvector/pg_trgm 함수 3개 | ⚠️ |

---

## 향후 작업 (우선순위순)

### 완료

| 작업 | 핵심 내용 | 상태 |
|------|----------|------|
| 예약 페이지 유입 경로 | 채널/캠페인 컬럼 추가 | ✅ 완료 |
| 단위 테스트 | Jest 53개 테스트 (security, channel, utm, date) | ✅ 완료 |
| 성능 모니터링 | Web Vitals 측정 (dev: 콘솔, prod: poor만 로깅) | ✅ 완료 |

### 홀드 (외부 의존성)

| 작업 | 핵심 내용 | 홀드 사유 |
|------|----------|----------|
| 카카오톡 채널 연동 | 카카오톡 문의 → 리드 자동 수집 | 카카오 비즈니스 API 키/권한 미확보 |
| 네이버 예약 연동 | 네이버 예약 → 리드 자동 수집 | 네이버 공개 API 없음, 파트너 API 접근 권한 필요 |

### 예정

| 작업 | 핵심 내용 |
|------|----------|
| MediChecker Phase 3 잔여 | 광고 소재 관리 → "검수" 버튼 연동 |
| MediChecker Phase 4 | 사용량 추적/월 quota, PDF 내보내기, 반복 위반 패턴 분석, 법률 데이터 CRUD (실사용 후 결정) |
| 코호트 분석 | 월별 가입자 리텐션 |
| 예측 모델 | LTV 예측, 이탈 예측 |
