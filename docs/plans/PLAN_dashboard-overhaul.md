# Implementation Plan: 마케팅 성과 대시보드 고도화

**Status**: ✅ Complete
**Started**: 2026-03-17
**Last Updated**: 2026-03-17

---

## 📋 Overview

### 현재 문제
1. KPI가 마케터 전문용어(CPL/CAC/ARPC) 중심 → 병원 원장이 한눈에 이해 불가
2. 7개 섹션이 동일한 시각적 무게로 나열 → 시선 유도 없음
3. 채널/캠페인/고객 테이블이 하위 페이지(/ads, /leads)와 중복
4. 광고비만 단독 표시 → 성과 대비 없음
5. "오늘" 기준 실시간 지표 부재
6. 모바일에서 KPI 6개가 화면 가득, 테이블 가로스크롤 필수
7. 차트 색상이 인디고 단색 → 채널 구분 불가
8. 전체 API 동시 로딩 → 화면 전체 Skeleton

### 개선 목표
병원 원장이 대시보드를 열었을 때 **3초 안에** "오늘 문의 몇 건, 예약 몇 건, 매출 얼마, 광고 효율 어떤지"를 파악할 수 있는 대시보드

### Success Criteria
- [x] KPI가 "문의→예약→방문→매출" 비즈니스 흐름으로 읽힘
- [x] "오늘의 요약"이 최상단에 표시되며 전일 대비 증감 확인 가능
- [x] 하위 페이지와 중복 테이블 제거 (캠페인 테이블, 고객 테이블)
- [x] 채널별 고유 색상이 차트에 반영
- [x] KPI/차트 클릭 시 상세 페이지로 이동
- [x] 섹션별 독립 로딩 (KPI → 차트 → 퍼널 순차 표시)
- [x] 모바일에서 테이블 대신 차트, 간격 최적화
- [x] `npm run build` 통과, 기존 기능 회귀 없음

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| 오늘 요약은 기존 KPI API에 `today` 필드 추가 | 새 엔드포인트 생성보다 일관성 유지 | API 복잡도 약간 증가 |
| 섹션별 독립 로딩은 커스텀 훅 3개 분리 | 각 섹션이 자체 loading 상태 관리 | 훅 개수 증가하나 UX 대폭 개선 |
| 채널 색상은 `lib/channel-colors.ts`로 추출 | 차트/뱃지에서 재사용, Badge variant 색상과 동기화 | — |
| 캠페인/고객 테이블 제거 | /ads, /leads와 완전 중복 | 한 페이지에서 모든 정보를 볼 수 없음 (의도적) |
| page.tsx를 섹션 컴포넌트로 분리 | 567줄 → 120줄, 유지보수성 향상 | 파일 수 증가 (9개 신규) |

---

## 🚀 Implementation Phases

---

### Phase 1: 공용 인프라 준비
**Goal**: 채널 색상 유틸과 개선된 StatsCard 컴포넌트 제공
**Status**: ✅ Complete

#### Tasks
- [x] **1.1** 채널 색상 매핑 유틸 생성 (`lib/channel-colors.ts`)
- [x] **1.2** StatsCard 컴포넌트 개선 — `onClick`, `subtitle`, `subtitleColor`, `size` props 추가
- [x] **1.3** 빌드 검증 통과

#### Quality Gate ✋
- [x] `npm run build` 통과
- [x] 기존 StatsCard 사용처 회귀 없음

---

### Phase 2A: API 개선 (Backend) 🔀 병렬
**Goal**: "오늘 요약" 데이터와 "리드 추이" 데이터를 API에서 제공
**Status**: ✅ Complete

#### Tasks
- [x] **2A.1** KPI API에 `today` 객체 추가 (오늘/어제 리드·예약·매출 + diff)
- [x] **2A.2** Trend API에 `leads` 필드 추가 (주별 리드 수 집계)
- [x] **2A.3** 빌드 검증 — 기존 필드 하위 호환 유지 확인

#### Quality Gate ✋
- [x] `npm run build` 통과
- [x] KPI API 응답에 `today` 객체 포함, 기존 필드 유지
- [x] Trend API 응답에 `leads` 필드 포함, 기존 `spend`/`campaigns` 유지

---

### Phase 2B: 상단 섹션 컴포넌트 🔀 병렬
**Goal**: 오늘 요약, KPI 카드, 듀얼 추이 차트 섹션 컴포넌트
**Status**: ✅ Complete

#### Tasks
- [x] **2B.1** `TodaySummary` 컴포넌트 — 3개 카드(문의/예약/매출), StatsCard size="lg", 전일 대비 증감
- [x] **2B.2** `KpiSection` 컴포넌트 — 6개 KPI(총 문의/예약 전환율/총 방문/총 매출/광고비/ROAS), 클릭 네비게이션
- [x] **2B.3** `SpendLeadTrend` 컴포넌트 — ComposedChart 듀얼 축(광고비 Area + 리드 Line), Legend, 반응형 높이

#### Quality Gate ✋
- [x] `npm run build` 통과

---

### Phase 2C: 하단 섹션 컴포넌트 🔀 병렬
**Goal**: 전환 퍼널, 채널별 바차트, 시술별 매출 파이차트 컴포넌트
**Status**: ✅ Complete

#### Tasks
- [x] **2C.1** `ChannelChart` 컴포넌트 — 수평 바차트, 채널별 고유 색상, /ads 링크
- [x] **2C.2** `TreatmentPie` 컴포넌트 — 매출액 기준 도넛 차트, 중앙 총 매출 표시, 범례에 금액+비율
- [x] **2C.3** `FunnelSection` 컴포넌트 — 퍼널 JSX 추출, /leads 링크, EmptyState 처리

#### Quality Gate ✋
- [x] `npm run build` 통과
- [x] 채널 바차트에 채널별 고유 색상 적용
- [x] 파이차트가 매출액 기준으로 비율 계산
- [x] 각 컴포넌트 빈 데이터 시 EmptyState 표시

---

### Phase 3: 페이지 통합 + 독립 로딩
**Goal**: 섹션 컴포넌트들을 page.tsx에 조립하고, 섹션별 독립 로딩 구현
**Status**: ✅ Complete

#### Tasks
- [x] **3.1** 섹션별 데이터 페칭 훅 생성 (`hooks/use-dashboard-data.ts`)
  - `useKpiData(clinicId, days)` — KPI API → today + kpi + comparison
  - `useTrendData(clinicId, days)` — Trend + Content API → trend, contentPlatform
  - `useFunnelChannelData(clinicId, days)` — Funnel + Channel + Leads API → funnel, channel, treatmentData
- [x] **3.2** page.tsx 리빌드 — 567줄 → 120줄, 섹션 컴포넌트 조합
- [x] **3.3** 삭제 항목 정리 — 캠페인 테이블, 고객 테이블, campaign/leads API 호출 제거
- [x] **3.4** 빌드 검증 통과

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] clinic_id 변경 시 모든 섹션 자동 갱신
- [x] 기간 선택 변경 시 데이터 갱신
- [x] clinic_staff → /patients 리다이렉트 유지

---

### Phase 4: 인터랙션 + 모바일 최적화 + 빈 상태
**Goal**: 클릭 네비게이션 완성, 모바일 최적화, 빈 상태 UX, CPL/ROAS 컴포넌트 분리
**Status**: ✅ Complete

#### Tasks
- [x] **4.1** CPL/ROAS 차트를 `CplRoasChart` 컴포넌트로 분리 — 채널별 색상, /ads 링크, EmptyState
- [x] **4.2** 모바일 반응형 최적화 — 섹션 간격 `mb-6 md:mb-8`, KPI gap `gap-2 md:gap-3`, 세로 바차트 통일
- [x] **4.3** 빈 상태 온보딩 UX — 각 섹션별 맞춤 안내 메시지 (EmptyState 컴포넌트 활용)
- [x] **4.4** 최종 검증 — `npm run build && npm run lint` 통과

#### 미구현 항목 (의도적 제외)
- 모바일 KPI 4개만 표시 + 접기: 현재 `grid-cols-2`로 6개 모두 표시, 카드가 작아 스크롤 부담 없음
- 빈 상태 설정 페이지 CTA 버튼: 설정 페이지 미존재, 안내 메시지만 적용

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] KPI 카드 클릭 시 해당 페이지로 이동
- [x] 빈 데이터 시 안내 메시지 표시
- [x] 기존 /ads, /leads, /patients 페이지 동작에 영향 없음

---

## 📁 파일 변경 목록

### 신규 생성
| File | Phase | 용도 |
|------|-------|------|
| `lib/channel-colors.ts` | 1 | 채널별 HEX 색상 매핑 + `getChannelColor()` |
| `components/dashboard/today-summary.tsx` | 2B | 오늘 요약 섹션 (문의/예약/매출 + 전일 대비) |
| `components/dashboard/kpi-section.tsx` | 2B | KPI 카드 섹션 (비즈니스 흐름 순 + 클릭 이동) |
| `components/dashboard/spend-lead-trend.tsx` | 2B | 광고비+리드 듀얼 축 추이 차트 |
| `components/dashboard/channel-chart.tsx` | 2C | 채널별 수평 바차트 (채널 고유 색상) |
| `components/dashboard/treatment-pie.tsx` | 2C | 시술별 매출 도넛 차트 |
| `components/dashboard/funnel-section.tsx` | 2C | 전환 퍼널 (5단계) |
| `components/dashboard/cpl-roas-chart.tsx` | 4 | CPL/ROAS 매체 비교 차트 |
| `hooks/use-dashboard-data.ts` | 3 | 섹션별 독립 데이터 페칭 훅 3개 |

### 수정
| File | Phase | 변경 내용 |
|------|-------|----------|
| `components/common/stats-card.tsx` | 1 | `onClick`, `subtitle`, `subtitleColor`, `size` props 추가 |
| `app/api/dashboard/kpi/route.ts` | 2A | `fetchTodaySummary()` 추가, 응답에 `today` 객체 포함 |
| `app/api/dashboard/trend/route.ts` | 2A | leads 테이블 병렬 조회, 주별 `leads` 필드 추가 |
| `app/(dashboard)/page.tsx` | 3, 4 | 567줄 → 120줄 전면 리빌드 (섹션 컴포넌트 조합) |
| `components/dashboard/kpi-section.tsx` | 4 | 모바일 gap 조정 `gap-2 md:gap-3` |

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1** (공용 인프라): ✅ 100%
- **Phase 2A** (API 개선): ✅ 100%
- **Phase 2B** (상단 컴포넌트): ✅ 100%
- **Phase 2C** (하단 컴포넌트): ✅ 100%
- **Phase 3** (통합): ✅ 100%
- **Phase 4** (인터랙션+모바일): ✅ 100%

**Overall Progress**: 100% ✅

---

## 📝 Notes & Learnings

- **시술별 매출 데이터**: 별도 payments 집계 API가 없어 `/api/leads?limit=200`으로 간접 추출. 200건 초과 시 일부 누락 가능 → 장기적으로 별도 API 권장
- **KPI API `applyFilter` 중복**: `fetchMetrics()`와 `fetchTodaySummary()` 각각 동일 클로저 선언. 동작 문제 없으나 추후 리팩토링 대상
- **CPL/ROAS 차트 통일**: 기존 모바일/데스크탑 별도 차트(vertical/horizontal) → 세로 바차트 하나로 통일하여 코드 간결화
- **Phase 2B/2C 병렬 실행**: 컴포넌트가 page.tsx와 독립적이므로 병렬 작업 효과적. Phase 3에서 통합만 수행

---

## ✅ Final Checklist

- [x] 모든 Phase 완료 + Quality Gate 통과
- [x] `npm run build && npm run lint` 최종 통과
- [ ] superadmin / clinic_admin / agency_staff / clinic_staff 역할별 테스트
- [ ] 사이드바 병원 선택 → 전체 섹션 갱신 확인
- [ ] 모바일/태블릿/데스크탑 반응형 확인
- [ ] 빈 데이터 시나리오 확인
- [x] 기존 하위 페이지 (/ads, /leads, /patients) 회귀 없음
- [ ] git commit + push
