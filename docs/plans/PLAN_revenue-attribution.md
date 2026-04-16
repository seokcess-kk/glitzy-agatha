# 매출 귀속(Revenue Attribution) 구현 계획

> **상태**: 대기
> **최종 수정**: 2026-03-16
> **예상 공수**: 4~6시간 (3 Phase)

**CRITICAL INSTRUCTIONS**: 각 Phase 완료 후:
1. ✅ 완료된 작업 체크박스 체크
2. 🧪 `npm run build` 빌드 검증
3. ⚠️ 브라우저에서 기능 확인
4. 📝 Notes 섹션에 이슈/학습 기록
5. ➡️ 모든 검증 통과 후 다음 Phase 진행

---

## 개요

### 목표
기존 `/ads` 광고 성과 페이지에 **"매출 귀속" 탭**을 추가하여, 채널/캠페인별로 **실제 결제 매출이 어디서 발생했는지** 한눈에 파악할 수 있게 한다.

### 핵심 결정사항
- **배치**: `/ads` 페이지에 탭 추가 (`[광고 성과] [매출 귀속]`)
- **귀속 모델**: 퍼스트터치 (첫 유입 채널에 매출 100% 귀속)
- **DB 변경**: 없음 — 기존 테이블 JOIN으로 해결
- **핵심 뷰 3가지**: 채널별 귀속표, 캠페인별 귀속표, 결제 고객 여정 타임라인

### 아키텍처

```
[기존] /ads 페이지
  ├─ 탭 1: 광고 성과 (기존 그대로)
  └─ 탭 2: 매출 귀속 (신규)
       ├─ GET /api/attribution/summary ← 채널/캠페인별 귀속 집계
       ├─ GET /api/attribution/customers ← 결제 고객 여정 목록
       └─ 프론트: 귀속표 + 고객 여정 시트

데이터 흐름:
  leads (utm_source, utm_campaign)
    → customers (first_source, first_campaign_id)
      → payments (customer_id, payment_amount)
        → 귀속: first_source별 매출 합산
```

---

## Phase 1: 귀속 API 구축 (1.5~2시간)

### 목표
채널/캠페인별 매출 귀속 데이터 + 결제 고객 여정 데이터를 반환하는 API 2개 생성

### 작업

- [ ] **`app/api/attribution/summary/route.ts`** 생성
  - `withClinicFilter` 래퍼 사용
  - 쿼리 파라미터: `startDate`, `endDate`
  - 로직:
    1. `payments` + `customers` JOIN → `first_source`별 매출 합산
    2. `payments` + `customers` JOIN → `first_campaign_id`별 매출 합산
    3. `leads` → 채널/캠페인별 리드 수
    4. `ad_campaign_stats` → 채널별 광고비
    5. 계산: 귀속매출, 리드수, 광고비, 결제고객수, ROI, 귀속ROAS, 귀속CPL
  - 응답 형식:
    ```json
    {
      "byChannel": [
        { "channel": "Meta", "leads": 30, "spend": 500000, "revenue": 1200000,
          "customers": 5, "roi": 140, "roas": 2.4 }
      ],
      "byCampaign": [
        { "campaign": "spring_promo", "channel": "Meta", "leads": 15,
          "spend": 200000, "revenue": 800000, "customers": 3, "roi": 300 }
      ],
      "totals": { "totalSpend": 1000000, "totalRevenue": 3000000, "totalCustomers": 12 }
    }
    ```

- [ ] **`app/api/attribution/customers/route.ts`** 생성
  - `withClinicFilter` 래퍼 사용
  - 쿼리 파라미터: `startDate`, `endDate`, `channel` (선택), `campaign` (선택)
  - 로직:
    1. `payments` + `customers` + `leads` + `bookings` + `consultations` JOIN
    2. 결제 고객별 전체 여정 조립 (첫 리드 → 예약 → 상담 → 결제)
    3. 채널/캠페인 필터 지원
  - 응답: 결제 고객 목록 + 각 고객의 여정 단계별 날짜/상태

### Quality Gate
- [ ] `npm run build` 통과
- [ ] curl로 API 응답 확인 (채널별, 캠페인별 데이터 반환)
- [ ] 멀티테넌트: clinic_id 필터 동작 확인
- [ ] 데이터 없을 때 빈 배열 정상 반환

---

## Phase 2: 매출 귀속 탭 UI (2~3시간)

### 목표
`/ads` 페이지에 탭 구조를 추가하고, 매출 귀속 뷰(채널표 + 캠페인표 + 고객 여정)를 구현

### 작업

- [ ] **`app/(dashboard)/ads/page.tsx`** 수정
  - 상단에 탭 UI 추가: `[광고 성과] [매출 귀속]`
  - 기존 광고 성과 내용을 탭 1로 래핑
  - 탭 2는 새 컴포넌트로 분리

- [ ] **`components/attribution/AttributionView.tsx`** 생성
  - 기간 선택 (7/14/30/90일)
  - **채널별 귀속표**: 채널명, 리드수, 광고비, 귀속매출, 결제고객수, ROI(%), ROAS
    - ROI 양수=초록, 음수=빨강 (의미 있는 2색 규칙)
    - 채널 클릭 시 해당 채널 고객 여정 필터
  - **캠페인별 귀속표**: 캠페인명, 채널, 리드수, 광고비, 귀속매출, 결제수, ROI
    - 광고비 0인 캠페인은 "오가닉" 표시
  - **결제 고객 여정 목록**: 고객명(마스킹), 유입채널, 캠페인, 첫유입일, 결제일, 결제액, 시술명
    - 행 클릭 시 타임라인 시트 열림

- [ ] **`components/attribution/CustomerJourneySheet.tsx`** 생성
  - Sheet (슬라이드 패널)로 개별 고객 여정 상세
  - 타임라인: 첫 리드 → (추가 리드들) → 예약 → 상담 → 결제
  - 각 단계별 날짜, 채널, 금액 표시
  - 기존 `components/common/customer-journey.tsx` 패턴 참고

### Quality Gate
- [ ] `npm run build` 통과
- [ ] 탭 전환 동작 (광고 성과 ↔ 매출 귀속)
- [ ] 기존 광고 성과 탭 기능 그대로 유지 (회귀 없음)
- [ ] 채널표/캠페인표 데이터 정상 표시
- [ ] 고객 여정 시트 열기/닫기 동작
- [ ] 기간 변경 시 데이터 갱신
- [ ] 데이터 없을 때 EmptyState 표시
- [ ] 모바일 반응형 확인

---

## Phase 3: 사이드바 + 연동 마무리 (0.5~1시간)

### 작업

- [ ] **`components/Sidebar.tsx`** — `/ads` 메뉴명을 "광고/매출" 또는 유지 (필요 시)
- [ ] **채널 클릭 → 고객 필터** 연동: 채널표에서 "Meta" 클릭 → 하단 고객 목록이 Meta만 필터
- [ ] **캠페인 클릭 → 고객 필터** 연동
- [ ] **숫자 포맷 통일**: 만원 단위 표시, % 소수점 1자리
- [ ] **로딩 상태**: Skeleton 표시
- [ ] **URL 상태 관리**: 탭 상태를 URL 쿼리로 (`?tab=attribution`) — 새로고침 시 유지

### Quality Gate
- [ ] `npm run build` 통과
- [ ] 전체 플로우: 탭 전환 → 기간 선택 → 채널 클릭 → 고객 필터 → 여정 시트
- [ ] 다른 페이지 영향 없음 확인
- [ ] superadmin 병원 전환 시 데이터 갱신

---

## 리스크 평가

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 결제-리드 연결 누락 (customer에 리드 없는 경우) | 중 | 중 | "직접 방문" 채널로 분류, 미귀속 건수 별도 표시 |
| 광고비-캠페인명 매칭 실패 | 중 | 낮 | 매칭 안 되면 광고비 0으로 표시, ROI 대신 "-" |
| 대량 데이터 시 쿼리 성능 | 낮 | 중 | 기간 필터 필수 적용, 페이지네이션 고려 |
| 기존 /ads 페이지 회귀 | 낮 | 높 | 탭 래핑만 하고 기존 코드 수정 최소화 |

## 롤백 전략

- Phase 1: API 파일 2개 삭제만으로 롤백
- Phase 2: `ads/page.tsx` git revert + 컴포넌트 파일 삭제
- Phase 3: Sidebar 변경 revert

---

## 파일 변경 목록

| 작업 | 파일 | 설명 |
|------|------|------|
| CREATE | `app/api/attribution/summary/route.ts` | 채널/캠페인별 귀속 집계 API |
| CREATE | `app/api/attribution/customers/route.ts` | 결제 고객 여정 API |
| CREATE | `components/attribution/AttributionView.tsx` | 매출 귀속 탭 메인 뷰 |
| CREATE | `components/attribution/CustomerJourneySheet.tsx` | 고객 여정 시트 |
| MODIFY | `app/(dashboard)/ads/page.tsx` | 탭 구조 추가 |
| MODIFY | `components/Sidebar.tsx` | 메뉴명 변경 (필요 시) |

---

## Notes & Learnings

_(구현 중 이슈/학습 기록)_
