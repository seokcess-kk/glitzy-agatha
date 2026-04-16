# Phase 5: 대시보드 고도화

> 기간: 2026-03-17~ | 상태: 진행 중
> 구현 계획: [PLAN_dashboard-overhaul.md](../plans/PLAN_dashboard-overhaul.md)

병원 원장이 3초 안에 핵심 지표를 파악할 수 있는 대시보드로 전면 개편

---

## P19-1: 공용 인프라 (Phase 1) — 완료

### 채널 색상 유틸
- `lib/channel-colors.ts` 신규 생성
- `CHANNEL_COLORS` 상수 + `getChannelColor()` 함수
- Meta=#3b82f6, Google=#ef4444, TikTok=#ec4899, Naver=#22c55e 등
- 부분 매칭 지원 (한글 채널명: 네이버, 카카오 등)
- Unknown 채널 → slate-500 fallback

### StatsCard 개선
- `components/common/stats-card.tsx` 수정
- 추가 props: `onClick`, `subtitle`, `subtitleColor`, `size`, `icon`
- `onClick`: cursor-pointer + hover 효과
- `size="lg"`: text-2xl→text-3xl, 패딩 증가 (오늘 요약용)
- `icon`: 라벨 우측에 아이콘 렌더링
- `subtitleColor`: positive(emerald)/negative(rose)/default(slate)

---

## P19-2A: KPI API 개선 (Phase 2A) — 완료

### 오늘 요약 추가
- `app/api/dashboard/kpi/route.ts` 수정
- `fetchTodaySummary()` 함수 추가 — KST 기준 오늘/어제 리드/예약/매출 조회
- 응답에 `today` 객체 항상 포함: `{ leads, bookings, revenue, leadsDiff, bookingsDiff, revenueDiff }`

### comparison 필드 확장
- `totalConsultations` 필드 응답에 추가 (기존 bookedCount 노출)
- comparison에 `totalLeads`, `totalConsultations`, `totalSpend` 추가

### Trend API 리드 추가
- `app/api/dashboard/trend/route.ts` 수정
- 기존 `spend` 외에 `leads` 필드 추가 (주별 리드 count)

---

## P19-2B: 상단 섹션 컴포넌트 (Phase 2B) — 완료

### TodaySummary
- `components/dashboard/today-summary.tsx` 신규
- 3카드(오늘 문의/예약/매출) 횡배열, StatsCard size="lg"
- 전일 대비 증감 → 색상 있는 subtitle로 표시 (trend 대신)
- 아이콘: MessageSquare, CalendarCheck, Banknote

### KpiSection
- `components/dashboard/kpi-section.tsx` 신규
- 6카드: 총 문의 → 예약 전환율 → 총 방문 → 총 매출 → 광고비 → ROAS
- `onNavigate` prop으로 카드 클릭 시 상세 페이지 이동
- 그리드: grid-cols-2 → md:3 → lg:6

### SpendLeadTrend
- `components/dashboard/spend-lead-trend.tsx` 신규
- ComposedChart로 광고비(Area) + 리드 수(Line) 듀얼 축
- 좌축: 광고비(₩만), 우축: 리드 수(건)
- DualChart 내부 컴포넌트로 데스크탑/모바일 코드 중복 제거
- `components/charts/index.tsx`에 ComposedChart dynamic import 추가

---

## P19-2C: 하단 섹션 컴포넌트 (Phase 2C) — 완료

### ChannelChart
- `components/dashboard/channel-chart.tsx` 신규
- 채널별 수평 바차트 (리드 수 + 결제 수)
- `getChannelColor()` 적용, "상세 보기 →" /ads 링크

### TreatmentPie
- `components/dashboard/treatment-pie.tsx` 신규
- 시술별 매출액 기준 도넛 차트 (기존 건수 → 매출액 변경)
- 범례에 금액 표시, 중앙에 총 매출

### FunnelSection
- `components/dashboard/funnel-section.tsx` 신규
- 기존 page.tsx 퍼널 JSX 추출, "전체 고객 여정 →" /leads 링크

---

## Phase 3~4: 미완료

- Phase 3: page.tsx 리빌드 + 섹션별 독립 로딩 훅
- Phase 4: 인터랙션 + 모바일 최적화 + 빈 상태 UX
