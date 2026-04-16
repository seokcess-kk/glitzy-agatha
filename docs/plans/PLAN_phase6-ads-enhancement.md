# Implementation Plan: Phase 6 — 광고 성과 고도화 (병렬 실행)

**Status**: ✅ Complete
**Started**: 2026-03-19
**Last Updated**: 2026-03-19

---

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 `npm run build && npm run lint` 실행
3. ⚠️ Quality Gate 전체 통과 확인
4. 📝 Notes 섹션에 이슈/학습 기록
5. ➡️ 모든 검증 통과 후 다음 Phase 진행

⛔ **빌드/린트 에러가 남은 상태로 다음 Phase 진행 금지**

---

## 📋 Overview

### 목표
6개 광고 성과 고도화 작업을 **4개 병렬 스트림**으로 분리하여 동시 진행

### 병렬 실행 구조

```
시간 →  ─────────────────────────────────────────────────────────

Stream A  ┃ Phase 1: 소재별 성과 API ┃ Phase 2: 소재별 성과 UI  ┃
(소재 분석)┃ (1.5h)                  ┃ (2h)                     ┃

Stream B  ┃ Phase 3: 이상치 알림     ┃ Phase 4: CSV 내보내기    ┃
(알림+내보내기)┃ (1.5h)               ┃ (1.5h)                  ┃

Stream C  ┃ Phase 5: 주간 리포트 집계 ┃ Phase 6: 리포트 발송     ┃
(리포트)   ┃ (2h)                    ┃ (1.5h)                   ┃

Stream D  ┃ Phase 7: 멀티터치 어트리뷰션 (Phase 1 이후 시작 가능) ┃
(어트리뷰션)┃ (3h)                                               ┃
```

### 의존성 맵

```
Stream A (소재)     → 독립 (바로 시작)
Stream B (알림+CSV) → 독립 (바로 시작)
Stream C (리포트)   → 독립 (바로 시작)
Stream D (멀티터치) → Stream A Phase 1 완료 후 시작 (귀속 API 검증 필요)
```

### Success Criteria
- [x] 소재별 성과 대시보드에서 utm_content 기준 리드수/전환율 확인 가능
- [x] CPL 임계값 초과 시 관리자 SMS 자동 알림
- [x] 리드 상태별 고객 CSV 다운로드 가능
- [x] 매주 월요일 병원별 주간 성과 SMS 발송
- [x] Linear/Time-decay 어트리뷰션 모델 선택 가능

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| 소재 성과는 utm_content 문자열 매칭 | ad_creative_id FK 없이 기존 데이터로 즉시 구현 가능 | 동일 utm_content 중복 시 구분 불가 |
| 이상치 감지는 sync-ads cron에 추가 | 별도 cron 불필요, 동기화 직후 최신 데이터로 비교 | cron 실행 시간 약간 증가 |
| CSV는 서버사이드 생성 | 대량 데이터 처리 + clinic_id 필터 보안 유지 | 클라이언트 메모리 절약 |
| 주간 리포트는 SMS 전용 | 이메일 클라이언트 미구축, SMS/알림톡 인프라 이미 존재 | 상세 리포트 첨부 불가 |
| 멀티터치는 leads 터치포인트 기반 | customer_journey 데이터 이미 존재, DB 변경 최소화 | 클릭/뷰 단위 추적은 불가 |

---

## 🚀 Stream A: 소재별 성과 분석

### Phase 1: 소재별 성과 API (1.5h)
**Goal**: utm_content 기준으로 소재별 리드수/결제수/전환율을 집계하는 API
**Status**: ✅ Complete

#### Tasks
- [x] **1.1** `app/api/ads/creatives-performance/route.ts` 생성
  - `withClinicFilter` 래퍼
  - 쿼리 파라미터: `startDate`, `endDate`
  - 로직:
    1. `leads` → `utm_content` 별 리드 수 집계
    2. `ad_creatives` JOIN → 소재명, 플랫폼, 랜딩페이지 매칭
    3. `payments` + `customers` JOIN → utm_content별 결제 고객수/매출
    4. 계산: 리드수, 결제수, 전환율(결제/리드), 매출, CPL(광고비 없으므로 생략 또는 캠페인 레벨 추정)
  - 응답:
    ```json
    {
      "creatives": [
        { "utm_content": "video_30s", "name": "3월 영상", "platform": "meta",
          "leads": 25, "customers": 5, "revenue": 800000, "conversionRate": 20.0 }
      ],
      "unmatched": { "leads": 10, "note": "utm_content 미매칭 리드" }
    }
    ```
- [x] **1.2** 빌드 검증

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] clinic_id 필터 동작 확인
- [x] utm_content가 없는 리드는 "unmatched"로 분류
- [x] 데이터 없을 때 빈 배열 반환

---

### Phase 2: 소재별 성과 UI (2h)
**Goal**: /ads 페이지에 소재별 성과 탭 또는 섹션 추가
**Status**: ✅ Complete
**의존성**: Phase 1 완료

#### Tasks
- [x] **2.1** `components/ads/CreativePerformance.tsx` 생성
  - 기간 선택 (7/14/30/90일)
  - 소재별 성과 테이블:
    - 컬럼: 소재명, 플랫폼, 리드수, 결제수, 전환율(%), 매출
    - 전환율 정렬 (높은순 기본)
    - 채널 뱃지 (`ChannelBadge`)
    - 빈 데이터 → EmptyState
  - 상위 5개 소재 바차트 (리드수 기준)
- [x] **2.2** `app/(dashboard)/ads/page.tsx` 수정 — 광고 성과 탭 내에 소재 성과 섹션 추가
- [x] **2.3** 빌드 검증 + 반복 수정 루프

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] 기존 광고 성과/매출 귀속 탭 회귀 없음
- [x] 기간 변경 시 데이터 갱신
- [ ] 모바일 반응형 확인 (개발서버에서 수동 확인 필요)

#### 파일 변경
| 작업 | 파일 |
|------|------|
| CREATE | `app/api/ads/creatives-performance/route.ts` |
| CREATE | `components/ads/CreativePerformance.tsx` |
| MODIFY | `app/(dashboard)/ads/page.tsx` |

---

## 🚀 Stream B: 알림 + CSV 내보내기

### Phase 3: 캠페인 성과 이상치 알림 (1.5h)
**Goal**: 광고 동기화 후 CPL/CTR 이상치 감지 → 관리자 SMS 알림
**Status**: ✅ Complete

#### Tasks
- [x] **3.1** `lib/ads-anomaly.ts` 생성
  - `detectAdsAnomalies(supabase, clinicId)` — 병원별 이상치 감지
  - `detectAllClinicAnomalies(supabase)` — 전체 활성 병원 순회 + 요약 메시지
  - 감지 규칙: CTR 급락(50% 미만), 일 지출 급증(200% 초과)
  - 최소 3일 히스토리 필요, KST 기준 날짜 처리
- [x] **3.2** `lib/error-alert.ts` 수정 — `'ads_anomaly'` 타입 추가
- [x] **3.3** `app/api/cron/sync-ads/route.ts` 수정
  - 동기화 성공 후 `detectAllClinicAnomalies()` 호출
  - 이상치 발견 시 `sendErrorAlert('ads_anomaly', summaryMessage)` 호출
  - `console.log` → `createLogger` 전환
- [x] **3.4** 빌드 검증 통과

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] 기존 sync-ads 동기화 로직 회귀 없음
- [x] 이상치 없을 때 알림 미발송
- [x] 쿨다운(5분) 동작 확인 (기존 error-alert 인프라 활용)

---

### Phase 4: 리타겟팅 오디언스 CSV 내보내기 (1.5h)
**Goal**: 리드 상태별/퍼널 이탈별 고객 CSV 다운로드 기능
**Status**: ✅ Complete

#### Tasks
- [x] **4.1** `app/api/leads/export/route.ts` 생성
  - `withClinicFilter` 래퍼
  - 쿼리 파라미터: `startDate`, `endDate`, `channel`, `stage`
  - CSV 컬럼: 이름, 전화번호(마스킹), 유입채널, 캠페인, 퍼널단계, 유입일, 시술, 랜딩페이지
  - UTF-8 BOM + Content-Disposition attachment
  - 전화번호 마스킹: `010-****-5678`
  - 최대 5000건 제한
- [x] **4.2** `app/(dashboard)/leads/page.tsx` 수정
  - PageHeader에 "CSV 내보내기" 버튼 추가 (Download 아이콘)
  - 현재 활성 필터(채널, 퍼널단계)를 쿼리에 반영
  - 다운로드: `fetch → blob → URL.createObjectURL → a.click()`
- [x] **4.3** 빌드 검증 통과

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] CSV 파일 한글 인코딩 정상 (UTF-8 BOM)
- [x] clinic_id 필터 동작 (withClinicFilter + applyClinicFilter)
- [x] 빈 데이터 시 헤더만 있는 CSV 반환

#### 파일 변경
| 작업 | 파일 |
|------|------|
| CREATE | `lib/ads-anomaly.ts` |
| MODIFY | `lib/error-alert.ts` |
| MODIFY | `app/api/cron/sync-ads/route.ts` |
| CREATE | `app/api/leads/export/route.ts` |
| MODIFY | `app/(dashboard)/leads/page.tsx` |

---

## 🚀 Stream C: 주간 리포트

### Phase 5: 주간 리포트 집계 API (2h)
**Goal**: 병원별 주간 성과 데이터 집계 + 리포트 생성
**Status**: ✅ Complete

#### Tasks
- [x] **5.1** `lib/services/weeklyReport.ts` 생성
  - `generateWeeklyReport(supabase, clinicId, weekStart, weekEnd)` 함수
  - 집계 항목:
    - 리드: 총 건수, 채널별 건수, 전주 대비 증감
    - 예약: 총 건수, 전환율, 전주 대비
    - 매출: 총 결제액, 전주 대비
    - 광고: 총 지출, ROAS, CPL, 전주 대비
    - 상위/하위 캠페인 각 3개 (리드 기준)
  - 반환: JSON 객체 + SMS용 텍스트 요약 (160자 이내)
- [x] **5.2** `app/api/cron/weekly-report/route.ts` 생성
  - `CRON_SECRET` 인증
  - 모든 활성 병원(`clinics.is_active = true`) 순회
  - 각 병원에 `generateWeeklyReport()` 호출
  - 성공/실패 로그 기록
  - 실패 시 `sendErrorAlert('weekly_report_fail', ...)` 호출
- [x] **5.3** 빌드 검증

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] 리포트 텍스트가 SMS 160자 이내
- [x] clinic_id 격리 확인
- [x] 데이터 없는 병원도 "데이터 없음" 리포트 생성

---

### Phase 6: 주간 리포트 발송 (1.5h)
**Goal**: 생성된 리포트를 SMS/알림톡으로 병원별 담당자에게 발송
**Status**: ✅ Complete
**의존성**: Phase 5 완료

#### Tasks
- [x] **6.1** `app/api/cron/weekly-report/route.ts` 수정
  - 리포트 생성 후 `clinics.notify_phones`로 SMS 발송
  - `notify_enabled = true`인 병원만 발송
  - `sendSmsWithLog()`으로 `sms_send_logs`에 발송 기록
- [x] **6.2** `vercel.json` 수정 — cron 스케줄 추가
  ```json
  { "path": "/api/cron/weekly-report", "schedule": "0 0 * * 1" }
  ```
  (매주 월요일 00:00 UTC = KST 09:00)
- [x] **6.3** 빌드 검증

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] notify_enabled=false 병원은 발송 안 됨
- [x] notify_phones 비어있는 병원 스킵
- [x] SMS 발송 로그 `sms_send_logs`에 기록

#### 파일 변경
| 작업 | 파일 |
|------|------|
| CREATE | `lib/services/weeklyReport.ts` |
| CREATE | `app/api/cron/weekly-report/route.ts` |
| MODIFY | `vercel.json` |

---

## 🚀 Stream D: 멀티터치 어트리뷰션

### Phase 7: 멀티터치 어트리뷰션 모델 (3h)
**Goal**: 기존 퍼스트터치 외 Linear/Time-decay 모델 추가
**Status**: ✅ Complete
**의존성**: 매출 귀속 기능 검증 완료

#### Tasks
- [x] **7.1** `lib/attribution-models.ts` 생성
  - `firstTouch(touchpoints[])` — 기존 로직 추출 (첫 터치에 100%)
  - `linearAttribution(touchpoints[])` — 모든 터치에 균등 분배
  - `timeDecayAttribution(touchpoints[], halfLifeDays=7)` — 결제일에 가까울수록 가중치
  - 공통 인터페이스:
    ```typescript
    type TouchPoint = { channel: string; campaign: string; date: string }
    type AttributionResult = { channel: string; campaign: string; weight: number }
    function applyModel(model: 'first' | 'linear' | 'time-decay', touchpoints: TouchPoint[], revenue: number): AttributionResult[]
    ```
- [x] **7.2** `app/api/attribution/summary/route.ts` 수정
  - 쿼리 파라미터: `model` (first/linear/time-decay, 기본값 first)
  - `model=first`: 기존 로직 유지 (customers.first_source)
  - `model=linear|time-decay`: 고객별 leads 터치포인트 조회 → 모델 적용 → 채널별 가중 합산
- [x] **7.3** `components/attribution/AttributionView.tsx` 수정
  - 상단에 모델 선택 드롭다운: "퍼스트 터치 / 균등 배분 / 시간 가중"
  - 모델 변경 시 API 재호출
  - 모델별 설명 텍스트
- [x] **7.4** 빌드 검증 + 반복 수정 루프

#### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] 퍼스트터치 결과가 기존과 동일 (회귀 없음)
- [ ] Linear: 터치포인트 3개면 각 33.3% 배분 확인 (개발서버에서 수동 확인 필요)
- [ ] Time-decay: 최근 터치포인트에 더 높은 가중치 확인 (개발서버에서 수동 확인 필요)
- [ ] 모델 전환 시 UI 정상 갱신 (개발서버에서 수동 확인 필요)

#### 파일 변경
| 작업 | 파일 |
|------|------|
| CREATE | `lib/attribution-models.ts` |
| MODIFY | `app/api/attribution/summary/route.ts` |
| MODIFY | `components/attribution/AttributionView.tsx` |

---

## ⚠️ Risk Assessment

| Risk | 확률 | 영향 | 대응 |
|------|------|------|------|
| utm_content 매칭률 낮음 (소재 미등록) | 중 | 중 | "미매칭" 건수 별도 표시, 소재 등록 안내 UX |
| 이상치 알림 과다 발송 (민감한 임계값) | 중 | 낮 | 쿨다운 5분 + 일일 50건 기존 제한 활용, 임계값 조정 가능하게 |
| CSV 대량 데이터 시 타임아웃 | 낮 | 중 | 기간 필터 필수, 최대 5000건 제한 |
| 주간 리포트 SMS 요금 | 낮 | 낮 | 활성 병원 수 × 주 1회, notify_enabled 제어 |
| 멀티터치 계산 성능 (대량 고객) | 중 | 중 | 기간 필터 필수, 결제 고객만 대상 (수백 건 수준) |
| 기존 /ads 페이지 회귀 | 낮 | 높 | 섹션 추가만, 기존 코드 수정 최소화 |

---

## 🔄 Rollback Strategy

| Stream | 롤백 방법 |
|--------|----------|
| A (소재 분석) | API 파일 + 컴포넌트 삭제, ads/page.tsx에서 섹션 제거 |
| B (알림) | `ads-anomaly.ts` 삭제, cron/sync-ads 변경 revert |
| B (CSV) | export API + 버튼 제거 |
| C (리포트) | cron 파일 + 서비스 삭제, vercel.json revert |
| D (멀티터치) | `attribution-models.ts` 삭제, API/UI에서 model 파라미터 제거 |

---

## 📊 Progress Tracking

| Stream | Phase | 작업 | 예상 시간 | 상태 |
|--------|-------|------|----------|------|
| A | 1 | 소재별 성과 API | 1.5h | ✅ |
| A | 2 | 소재별 성과 UI | 2h | ✅ |
| B | 3 | 이상치 알림 | 1.5h | ✅ |
| B | 4 | CSV 내보내기 | 1.5h | ✅ |
| C | 5 | 주간 리포트 집계 | 2h | ✅ |
| C | 6 | 리포트 발송 | 1.5h | ✅ |
| D | 7 | 멀티터치 어트리뷰션 | 3h | ✅ |
| | | **합계** | **13.5h** | |

**병렬 실행 시 실 소요시간**: ~6.5h (Stream A 3.5h + Stream D 3h이 최장 경로)

---

## 📝 Notes & Learnings

- **Stream A 코드 리뷰**: unmatchedLeads 이중 카운트 버그 발견 → 매칭/미매칭 분리로 수정. `toISOString().split('T')[0]` 금지 패턴 위반 → `getKstDateString()` 전환. AttributionView도 동일 문제 있어 함께 수정
- **Stream D 멀티터치**: Supabase `.in()` 파라미터 500개 이상 시 성능 이슈 가능 — 현재 병원 규모에서는 문제 없으나 향후 chunk 처리 검토
- **payments 기간 필터 정책**: `creatives-performance`는 결제 기간 필터 미적용(리드 기준 귀속), `attribution/summary`는 적용 — 의도적 차이, 소재 분석은 "이 소재로 유입된 고객의 총 매출"이 더 유의미

---

## 📚 References

- [PLAN_revenue-attribution.md](PLAN_revenue-attribution.md) — 매출 귀속 기존 계획 (95% 완료)
- [PLAN_dashboard-overhaul.md](PLAN_dashboard-overhaul.md) — 대시보드 고도화 (완료)
- `app/api/attribution/` — 기존 귀속 API (구현 완료)
- `lib/error-alert.ts` — 에러 알림 인프라
- `lib/solapi.ts` — SMS 발송 인프라
- `lib/qstash.ts` — QStash 작업 큐 클라이언트
