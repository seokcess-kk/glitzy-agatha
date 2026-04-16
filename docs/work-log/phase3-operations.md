# Phase 3: 운영 기능 개발

> 기간: 2026-03-16~ | 상태: 진행중

캠페인 리드 관리, 담당자 알림, 리드 상태 관리, 예약 등록, UTM 페이지 개편 등 운영 기능 개발 기록

---

## P13: 캠페인별 리드 뷰 페이지 (2026-03-16)

### 목표
캠페인별 리드를 한눈에 관리할 수 있는 전용 페이지 추가. clinic_admin도 접근 가능.

### 신규 파일

| 파일 | 용도 |
|------|------|
| `app/(dashboard)/campaigns/page.tsx` | 캠페인 리드 뷰 페이지 |
| `app/api/campaigns/route.ts` | 캠페인 집계 + 상세 리드 목록 API |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `components/Sidebar.tsx` | "고객 관리" 그룹에 "캠페인 리드" 메뉴 추가 |

### 구현 내용

#### 1. 캠페인 목록 → 상세 리드 전환
- 진입 시 캠페인 카드 목록 표시 (캠페인명, 리드 수, 오늘 유입, 랜딩페이지)
- 카드 클릭 → 해당 캠페인의 리드 상세 목록으로 전환

#### 2. 캠페인 API
```
GET /api/campaigns
→ 캠페인별 리드 수, 오늘 유입, 챗봇 발송 현황, 대표 채널

GET /api/campaigns?campaign=march_promo
→ 해당 캠페인 리드 상세 목록 (이름, 전화, 설문, 유입일시)
```

#### 3. 리드 상세 뷰 개선
- 리드 카드에 설문 응답(custom_data.survey) 태그 형태로 표시
- 마케팅 수신 동의, 랜딩페이지, 소재 즉시 확인 가능
- 캠페인 상세 요약 카드 추가

### 코드 리뷰 후 수정

| 우선순위 | 문제 | 수정 내용 |
|---------|------|----------|
| 높음 | API limit 없어 대량 데이터 시 성능 | 목록 2000, 상세 500 limit 추가 |
| 중간 | 대표 채널이 첫 번째 리드 기준 | 최다 빈도 채널로 변경 |
| 낮음 | "today" 영어 텍스트 | "오늘"로 한국어 통일 |

### 커밋
```
96f7166 feat: P13 캠페인별 리드 뷰 페이지 추가
38465d9 fix: P13 캠페인 리드 코드 리뷰 반영
0368e7e feat: 캠페인 리드 상세 뷰 개선 - 설문 응답 인라인 표시
```

---

## P14: 리드 유입 시 병원 담당자 알림 (2026-03-16)

### 목표
랜딩 페이지를 통해 리드가 유입되면 병원 담당자에게 실시간 SMS 알림 발송

### 신규 파일

| 파일 | 용도 |
|------|------|
| `lib/solapi.ts` | 솔라피 SMS 발송 클라이언트 (HMAC-SHA256 인증) |
| `app/api/admin/clinics/[id]/route.ts` | 병원 알림 설정 PATCH API |
| `supabase/migrations/20260316_clinic_notify.sql` | clinics 테이블에 notify_phone, notify_enabled 추가 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/webhook/lead/route.ts` | 리드 생성 직후 담당자 SMS 발송 로직 추가 |
| `app/(dashboard)/admin/clinics/page.tsx` | 알림 설정 다이얼로그 (담당자 연락처, 활성화 토글) |

### 구현 내용

#### 1. 솔라피 SMS 클라이언트
```typescript
// lib/solapi.ts
- HMAC-SHA256 인증 헤더 자동 생성
- SMS(90바이트 이하) / LMS(초과) 자동 판별
- 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER
```

#### 2. 알림 플로우
```
리드 유입 (webhook/lead)
  → 리드 DB 저장
  → 병원 notify_enabled 확인
  → SMS 발송 (non-blocking, 실패해도 리드 등록 완료)
```

#### 3. 병원 관리 페이지 알림 설정
- 알림 설정 다이얼로그 (담당자 전화번호 입력, 활성/비활성 토글)
- `/api/admin/clinics/[id]` PATCH API

### DB 변경
```sql
ALTER TABLE clinics ADD COLUMN notify_phone VARCHAR(20);
ALTER TABLE clinics ADD COLUMN notify_enabled BOOLEAN DEFAULT false;
```

### 커밋
```
2f51711 feat: P14 리드 유입 시 병원 담당자 알림 기능
b02dd2d feat: 담당자 알림을 솔라피 SMS로 변경
994e415 fix: 담당자 SMS 템플릿 변경 - 캠페인명 제거, 간결화
```

---

## P15: 캠페인 리드 상태 관리 및 메모 (2026-03-16)

### 목표
캠페인 리드별 상태(신규/부재/상담완료/예약완료/보류/거절) 관리 및 메모 기능 추가. 예약완료 전환 시 bookings 자동 생성.

### 신규 파일

| 파일 | 용도 |
|------|------|
| `app/api/leads/[id]/route.ts` | 리드 상태/메모 변경 PATCH API |
| `supabase/migrations/20260316_lead_status.sql` | leads 테이블에 lead_status 컬럼 추가 |
| `supabase/migrations/20260316_lead_notes.sql` | leads 테이블에 notes 컬럼 추가 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/campaigns/page.tsx` | 상태 드롭다운, 상태별 카운트 요약, 메모 입력/저장 UI |
| `app/api/campaigns/route.ts` | lead_status, notes, custom_data 필드 포함 |

### 구현 내용

#### 1. 리드 상태 관리
```
상태 종류: 신규(new) / 부재(no_answer) / 상담완료(consulted) / 예약완료(booked) / 보류(pending) / 거절(rejected)
```
- 상태 드롭다운으로 즉시 변경
- 상태별 카운트 요약 카드 표시
- 이름 표시 우선순위: custom_data.name (이번 유입) > customer.name (기존)

#### 2. 예약완료 자동 전환
```
리드 상태 → "예약완료" 변경 시:
  → bookings 테이블에 예약 자동 생성
  → 리드 메모가 bookings.notes로 전달
  → 예약/결제 관리 페이지에서 확인 가능
```

#### 3. 메모 기능
- 인라인 메모 입력/저장 UI
- `/api/leads/[id]` PATCH로 저장
- 예약 전환 시 메모 자동 연동

### DB 변경
```sql
ALTER TABLE leads ADD COLUMN lead_status VARCHAR(20) DEFAULT 'new';
ALTER TABLE leads ADD COLUMN lead_status_updated_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN notes TEXT;
```

### 버그 수정
- `booking_date` → `booking_datetime` 컬럼명 수정 (예약 생성 불가 버그)

### 커밋
```
83de85a feat: 캠페인 리드 상태 관리 (신규/부재/상담완료/예약완료/보류/거절)
6adf183 fix: 예약 생성 시 booking_date → booking_datetime 컬럼명 수정
bcb9dbc feat: 캠페인 리드 메모 기능 + 예약 전환 시 메모 연동
382493c fix: 리드 유입 시 입력한 이름을 캠페인 리드에 표시
```

---

## P16: 예약/결제 페이지 예약 등록 기능 (2026-03-16)

### 목표
예약/결제 관리 페이지에서 직접 예약을 등록할 수 있는 기능 추가 (walk-in, 전화 예약 등)

### 신규 파일

| 파일 | 용도 |
|------|------|
| `app/api/bookings/route.ts` | 예약 생성 POST API (고객 조회/생성 + 예약 생성) |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/patients/page.tsx` | 예약 등록 다이얼로그 추가 |

### 구현 내용

#### 1. 예약 등록 다이얼로그
- 이름, 전화번호, 예약일시 (날짜 + 10분 단위 시간), 유입경로, 메모 입력
- 예약 날짜: 오늘 이후만 선택 가능
- 예약 시간: 08:00~20:00, 10분 단위 드롭다운
- 등록일시: 서버에서 자동 입력

#### 2. Bookings POST API
```
POST /api/bookings
→ 전화번호로 기존 고객 조회
→ 없으면 customers 테이블에 자동 생성
→ bookings 테이블에 예약 생성
→ 유입경로: walk-in, phone, transfer, online, other
```

### UX 개선
- 등록일시 필드 제거 (불필요한 정보 노출 방지)
- 예약날짜/시간/유입경로를 한 행으로 정리

### 커밋
```
de204a4 feat: 예약/결제 페이지에 예약 등록 기능 추가
d7c59a7 fix: 예약 등록 - 등록일시 자동입력 + 예약일시 날짜/10분단위 시간 분리
80651a5 fix: 예약 등록 폼에서 등록일시 필드 제거
```

---

## P17: UTM 생성 페이지 개편 (2026-03-16)

### 목표
UTM 생성기 페이지를 목록 + 생성기 분리 구조로 개편

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/utm/page.tsx` | 목록/생성기 모드 분리, UTM 링크 목록 뷰 추가 |
| `components/Sidebar.tsx` | 메뉴명 "UTM 생성기" → "UTM 생성" |

### 구현 내용

#### 1. 페이지 모드 분리
```
[UTM 생성] 페이지 진입
  → 목록 모드: 생성된 UTM 링크 목록 (검색, 복사, 삭제)
  → "UTM 생성" 버튼 클릭 → 생성기 모드
  → "← UTM 목록" 버튼 클릭 → 목록 모드로 복귀
```

#### 2. UTM 링크 목록
- 라벨, UTM 태그, 생성일시 표시
- 검색 (라벨, 소스, 캠페인, 콘텐츠)
- 링크 복사, 삭제 액션

### 커밋
```
74760a9 feat: UTM 생성기 → UTM 생성 페이지 개편 (목록 + 생성기 분리)
```
