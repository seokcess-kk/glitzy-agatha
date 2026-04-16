# Phase 6: 광고 성과 고도화

> 기간: 2026-03-19 | 상태: 완료
> 구현 계획: [PLAN_phase6-ads-enhancement.md](../plans/PLAN_phase6-ads-enhancement.md)

4개 스트림 병렬 실행으로 광고 분석 기능 전면 강화

---

## Stream A: 소재별 성과 분석 — 완료

### P21-1: 소재별 성과 API
- `app/api/ads/creatives-performance/route.ts` 신규
- `withClinicFilter` + `applyClinicFilter` 3개 쿼리 병렬 실행
- leads.utm_content → ad_creatives 메타데이터 매칭
- payments → customer → utm_content 역추적으로 결제/매출 집계
- 미매칭 리드는 `unmatched` 필드로 분리
- 결제에 기간 필터 미적용 (리드 기준 귀속)

### P21-2: 소재별 성과 UI
- `components/ads/CreativePerformance.tsx` 신규
- 기간 선택 (7/14/30/90일) + 상위 5개 소재 수평 바차트 + 성과 테이블
- `getKstDateString()` 사용 (KST 날짜 오류 방지)
- 차트 높이: `Math.min(400, Math.max(items * 44 + 20, 160))`
- `app/(dashboard)/ads/page.tsx` 수정 — 광고 성과 탭 하단에 섹션 추가

---

## Stream B: 알림 + CSV 내보내기 — 완료

### P21-3: 캠페인 성과 이상치 알림
- `lib/ads-anomaly.ts` 신규 — CTR 급락(50% 미만), 일 지출 급증(200% 초과) 감지
- `lib/error-alert.ts` 수정 — `'ads_anomaly'` 에러 타입 추가
- `app/api/cron/sync-ads/route.ts` 수정 — 동기화 후 이상치 감지 + SMS 알림

### P21-4: 리타겟팅 오디언스 CSV 내보내기
- `app/api/leads/export/route.ts` 신규 — 퍼널단계/채널 필터, UTF-8 BOM, 전화번호 마스킹, 최대 5000건
- `app/(dashboard)/leads/page.tsx` 수정 — CSV 내보내기 버튼 추가

---

## Stream C: 주간 리포트 — 완료

### P21-5: 주간 리포트 집계
- `lib/services/weeklyReport.ts` 신규 — 리드/예약/매출/광고 주간 집계 + SMS 요약 텍스트
- `app/api/cron/weekly-report/route.ts` 신규 — 활성 병원 순회, 리포트 생성

### P21-6: 주간 리포트 발송
- 리포트 생성 후 `clinics.notify_phones`로 SMS 발송
- `vercel.json` 수정 — 매주 월요일 09:00 KST cron 스케줄

---

## Stream D: 멀티터치 어트리뷰션 — 완료

### P21-7: 멀티터치 어트리뷰션 모델
- `lib/attribution-models.ts` 신규 — first/linear/time-decay 3종 모델
  - firstTouch: 첫 터치 100%
  - linear: 균등 분배 + 중복 채널 합산
  - timeDecay: 지수 감쇠 (반감기 7일), 정규화
- `app/api/attribution/summary/route.ts` 수정 — `model` 파라미터 추가, 멀티터치 시 고객별 leads 일괄 조회 (N+1 방지)
- `components/attribution/AttributionView.tsx` 수정 — 모델 선택 드롭다운 + 설명 텍스트

---

## 파일 변경 전체 목록

| 작업 | 파일 | Stream |
|------|------|--------|
| CREATE | `app/api/ads/creatives-performance/route.ts` | A |
| CREATE | `components/ads/CreativePerformance.tsx` | A |
| MODIFY | `app/(dashboard)/ads/page.tsx` | A |
| CREATE | `lib/ads-anomaly.ts` | B |
| MODIFY | `lib/error-alert.ts` | B |
| MODIFY | `app/api/cron/sync-ads/route.ts` | B |
| CREATE | `app/api/leads/export/route.ts` | B |
| MODIFY | `app/(dashboard)/leads/page.tsx` | B |
| CREATE | `lib/services/weeklyReport.ts` | C |
| CREATE | `app/api/cron/weekly-report/route.ts` | C |
| MODIFY | `vercel.json` | C |
| CREATE | `lib/attribution-models.ts` | D |
| MODIFY | `app/api/attribution/summary/route.ts` | D |
| MODIFY | `components/attribution/AttributionView.tsx` | D |
