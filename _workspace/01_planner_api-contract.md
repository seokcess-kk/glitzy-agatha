# Agatha API 계약서

> 모든 API는 `/api/` 접두사. 인증은 NextAuth JWT 세션 기반.
> `[C]` = Client 필터 적용 (client_id 기준 멀티테넌트 격리)

---

## 1. 인증 (Auth)

### 기존 유지 (수정)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| POST | `/api/auth/[...nextauth]` | NextAuth 핸들러 (로그인/세션) | 수정: username → phone_number 인증 |
| PATCH | `/api/users/me/password` | 비밀번호 변경 | 유지 |

### 신규

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/signup` | 초대 토큰 검증 + 회원가입 |

#### `POST /api/auth/signup`
```typescript
// Request
{
  token: string          // 초대 토큰
  name: string           // 이름
  phone_number: string   // 010-XXXX-XXXX
  password: string       // 비밀번호
}

// Response 201
{
  id: number
  name: string
  phone_number: string
  role: string
  client_id: number | null
}

// Error 400: 유효하지 않은 토큰 / 만료 / 이미 사용됨
// Error 409: 이미 등록된 전화번호
```

---

## 2. 대시보드 (Dashboard) `[C]`

### 기존 유지 (수정)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/dashboard/kpi` | KPI 요약 (리드, 전환, CPL, ROAS) | 수정: Agatha KPI 지표로 변경, 전환율/거부율/보류율 추가 |
| GET | `/api/dashboard/channel` | 채널별 성과 테이블 | 수정: 전환율/거부율/보류율/노쇼율 컬럼 추가 |
| GET | `/api/dashboard/funnel` | 퍼널 데이터 | 수정: New→InProgress→Converted + hold/lost 비율 |
| GET | `/api/dashboard/trend` | 일별 트렌드 (리드/전환/광고비) | 유지 |
| GET | `/api/dashboard/campaign` | 캠페인별 성과 | 유지 |

### 삭제

| 경로 | 사유 |
|------|------|
| `/api/dashboard/treatment-revenue` | 시술 매출 — 병원 전용 |

### 신규

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/dashboard/budget` | 예산 소진 현황 |

#### `GET /api/dashboard/budget?client_id=1&month=2026-04`
```typescript
// Response
{
  current_budget: number       // 현재 월 예산
  total_spend: number          // 누적 소진
  burn_rate: number            // 소진율 (%)
  daily_average: number        // 일 평균 소진
  estimated_month_end: number  // 예상 월말 지출
  days_elapsed: number
  days_remaining: number
}
```

---

## 3. 광고 성과 (Ads) `[C]`

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/ads/platform-summary` | 플랫폼별 요약 | 유지 |
| GET | `/api/ads/stats` | 캠페인별 통계 | 유지 |
| GET | `/api/ads/efficiency-trend` | CPL/ROAS 추이 | 유지 |
| GET | `/api/ads/day-analysis` | 요일별 분석 | 유지 |
| GET | `/api/ads/creatives-performance` | 소재별 성과 | 유지 |
| GET | `/api/ads/landing-page-analysis` | LP별 분석 | 유지 |
| GET | `/api/ads/landing-page-performance` | LP 성과 상세 | 유지 |
| POST | `/api/ads/sync` | 수동 광고 동기화 | 유지 |

---

## 4. 캠페인 (Campaigns) `[C]`

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/campaigns` | 캠페인 목록 | 유지 (clinic_id → client_id 리네이밍) |

---

## 5. 고객관리 (Customers) `[C]`

### 기존 유지 (수정)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/leads` | 리드 목록 (필터: 상태/채널/기간/캠페인/LP) | 수정: status enum 확장, contact 연결 |
| POST | `/api/leads` | 리드 생성 (수동 등록 포함) | 수정: 유입 경로 선택 추가, contact 자동 생성/연결 |
| GET | `/api/leads/[id]` | 리드 상세 | 수정: contact 정보 포함 |
| PATCH | `/api/leads/[id]` | 리드 상태 변경 (전환/미전환/보류 + 금액 + 사유) | 수정: conversion_value, lost_reason, contact 업데이트 |
| GET | `/api/leads/export` | 리드 CSV 내보내기 | 유지 |

### 신규

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/customers/contacts` | 고객(연락처) 목록 |
| GET | `/api/customers/contacts/[id]` | 고객 상세 + 리드 이력 타임라인 |
| PATCH | `/api/customers/contacts/[id]` | 고객 정보 수정 |

#### `GET /api/customers/contacts?client_id=1&page=1&limit=20&search=홍길동`
```typescript
// Response
{
  data: Array<{
    id: number
    phone_number: string        // 마스킹: 010-1234-****
    name: string
    first_source: string        // 최초 유입 채널
    first_campaign_id: string
    total_conversions: number
    total_conversion_value: number
    lead_count: number          // 총 문의 수
    last_lead_at: string        // 최근 문의일
    created_at: string
  }>
  total: number
  page: number
}
```

#### `GET /api/customers/contacts/[id]`
```typescript
// Response
{
  contact: {
    id: number
    phone_number: string
    name: string
    first_source: string
    total_conversions: number
    total_conversion_value: number
    created_at: string
  }
  leads: Array<{               // 시간순 리드 이력
    id: number
    utm_source: string
    utm_campaign: string
    status: string
    conversion_value: number
    created_at: string
    status_changed_at: string
  }>
}
```

#### `PATCH /api/leads/[id]` (수정)
```typescript
// Request
{
  status: 'in_progress' | 'converted' | 'lost' | 'hold' | 'invalid'
  conversion_value?: number     // converted일 때 필수
  lost_reason?: string          // lost일 때 선택
  conversion_memo?: string      // 메모
}

// Response
{
  id: number
  status: string
  conversion_value: number | null
  lost_reason: string | null
  conversion_memo: string | null
  status_changed_at: string
  contact: {                    // 업데이트된 contact 정보
    total_conversions: number
    total_conversion_value: number
  }
}
```

#### `POST /api/leads` (수동 등록 — 수정)
```typescript
// Request
{
  client_id: number
  name: string
  phone_number: string
  utm_source: 'phone' | 'visit' | 'referral' | 'other'  // 수동 유입 경로
  memo?: string
}

// Response 201
{
  lead: { id, status, utm_source, ... }
  contact: { id, phone_number, name, ... }   // 신규 생성 또는 기존 연결
  is_new_contact: boolean
}
```

---

## 6. 어트리뷰션 (Attribution) `[C]`

### 기존 유지 (수정)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/attribution/summary` | 전환 요약 | 수정: Agatha KPI 기준 |
| GET | `/api/attribution/customers` | 전환 고객 목록 | 수정: contact 기반으로 변경 |
| GET | `/api/attribution/roas-trend` | ROAS 추이 | 유지 |

---

## 7. 순위 모니터링 (Monitoring) `[C]`

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/monitoring/keywords` | 키워드 목록 | 유지 |
| POST | `/api/monitoring/keywords` | 키워드 등록 | 유지 |
| GET | `/api/monitoring/rankings` | 순위 데이터 | 유지 |
| POST | `/api/monitoring/rankings/bulk` | 순위 일괄 입력 | 유지 |

---

## 8. UTM 관리 `[C]`

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET/POST | `/api/utm/templates` | UTM 템플릿 CRUD | 유지 |
| GET/PATCH/DELETE | `/api/utm/templates/[id]` | UTM 템플릿 상세 | 유지 |
| GET/POST | `/api/utm/links` | UTM 링크 CRUD | 유지 |
| GET/DELETE | `/api/utm/links/[id]` | UTM 링크 상세 | 유지 |

---

## 9. 관리자 — 클라이언트 (Admin Clients)

### 기존 유지 (수정: clinics → clients)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/admin/clients` | 클라이언트 목록 | 리네이밍 |
| POST | `/api/admin/clients` | 클라이언트 생성 | 리네이밍 |
| GET | `/api/admin/clients/[id]` | 클라이언트 상세 | 리네이밍 |
| PATCH | `/api/admin/clients/[id]` | 클라이언트 수정 | 리네이밍 |
| DELETE | `/api/admin/clients/[id]` | 클라이언트 삭제 | 리네이밍 |
| GET | `/api/admin/clients/[id]/api-configs` | API 설정 조회 | 리네이밍 |
| PUT | `/api/admin/clients/[id]/api-configs` | API 설정 저장 | 리네이밍 |
| POST | `/api/admin/clients/[id]/api-configs/test` | API 연결 테스트 | 리네이밍 |

### 신규

| 메서드 | 경로 | 설명 |
|--------|------|------|
| PATCH | `/api/admin/clients/[id]/budget` | 예산 수정 (사유 포함) |
| GET | `/api/admin/clients/[id]/budget/history` | 예산 변경 이력 |
| GET | `/api/admin/clients/[id]/report-settings` | 리포트 발송 설정 조회 |
| PUT | `/api/admin/clients/[id]/report-settings` | 리포트 발송 설정 저장 |

#### `PATCH /api/admin/clients/[id]/budget`
```typescript
// Request
{
  new_budget: number
  memo: string           // 변경 사유
}

// Response
{
  client_id: number
  old_budget: number
  new_budget: number
  memo: string
  changed_at: string
}
```

#### `GET /api/admin/clients/[id]/budget/history`
```typescript
// Response
{
  history: Array<{
    id: number
    old_budget: number
    new_budget: number
    memo: string
    changed_by: { id: number, name: string }
    changed_at: string
  }>
}
```

#### `PUT /api/admin/clients/[id]/report-settings`
```typescript
// Request
{
  frequency: 'weekly' | 'monthly' | 'disabled'
  send_day: number          // 주간: 0(일)~6(토), 월간: 1~28
  send_hour: number         // 0~23 (KST)
  is_active: boolean
}
```

---

## 10. 관리자 — 사용자/초대

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/admin/users` | 사용자 목록 | 수정: 역할명 변경 |
| POST | `/api/admin/users` | 사용자 직접 생성 | 수정: phone_number 기반 |
| GET | `/api/admin/users/[id]/permissions` | 메뉴 권한 조회 | 유지 |
| PUT | `/api/admin/users/[id]/permissions` | 메뉴 권한 설정 | 유지 |

### 신규

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/invitations` | 초대 목록 |
| POST | `/api/admin/invitations` | 초대 생성 |
| DELETE | `/api/admin/invitations/[id]` | 초대 취소 |
| POST | `/api/admin/invitations/[id]/resend` | 초대 재발송 |

#### `POST /api/admin/invitations`
```typescript
// Request
{
  client_id: number
  role: 'agency_staff' | 'client_admin' | 'client_staff'
  expires_days?: number     // 기본 7일
}

// Response 201
{
  id: number
  token: string
  signup_url: string        // /signup?token=xxxxx
  client: { id: number, name: string }
  role: string
  expires_at: string
  status: 'pending'
}
```

#### `GET /api/admin/invitations?status=pending&client_id=1`
```typescript
// Response
{
  data: Array<{
    id: number
    client: { id: number, name: string }
    role: string
    invited_by: { id: number, name: string }
    expires_at: string
    status: 'pending' | 'completed' | 'expired' | 'cancelled'
    completed_by?: { id: number, name: string }
    completed_at?: string
    created_at: string
  }>
}
```

---

## 11. 관리자 — 기타

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET/POST | `/api/admin/ad-creatives` | 광고 소재 CRUD | 유지 |
| PATCH/DELETE | `/api/admin/ad-creatives/[id]` | 소재 상세 | 유지 |
| POST | `/api/admin/ad-creatives/upload` | 소재 썸네일 업로드 | 유지 |
| GET/POST | `/api/admin/landing-pages` | LP CRUD | 유지 |
| PATCH/DELETE | `/api/admin/landing-pages/[id]` | LP 상세 | 유지 |
| GET | `/api/admin/landing-pages/stats` | LP 통계 | 유지 |
| POST | `/api/admin/landing-pages/upload` | LP 이미지 업로드 | 유지 |
| GET | `/api/admin/login-logs` | 로그인 로그 | 유지 |
| GET/PUT | `/api/admin/menu-settings` | 메뉴 표시 설정 | 유지 |

---

## 12. 내 정보 (My)

### 기존 유지 (수정)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET | `/api/my/clients` | 내 클라이언트 목록 | 리네이밍: `/api/my/clinics` → `/api/my/clients` |
| GET | `/api/my/menu-permissions` | 내 메뉴 권한 | 유지 |

---

## 13. 외부/웹훅

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| POST | `/api/webhook/lead` | 외부 리드 수신 웹훅 | 수정: contact 자동 연결 |
| GET | `/api/lp/meta` | LP 메타 정보 | 유지 |
| GET | `/api/lp/render` | LP 렌더링 | 유지 |
| GET | `/api/landing-pages` | 공개 LP 목록 | 유지 |

---

## 14. Cron Jobs

### 기존 유지 (수정)

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| POST | `/api/cron/sync-ads` | 광고 데이터 자동 동기화 (06:00 KST) | 유지 |
| POST | `/api/cron/weekly-report` | 리포트 발송 (08:00 KST) | 수정: 클라이언트별 설정 기반, 주간/월간 분기 |

### 삭제

| 경로 | 사유 |
|------|------|
| `/api/cron/sync-press` | 언론보도 — 삭제 |

---

## 15. 기타

### 기존 유지

| 메서드 | 경로 | 설명 | Samantha 변경 |
|--------|------|------|--------------|
| GET/PUT | `/api/menu-visibility` | 메뉴 표시/숨김 | 유지 |
| POST | `/api/admin/backfill-ads` | 광고 데이터 백필 | 유지 |
| POST | `/api/qstash/sms-retry` | SMS 재시도 | 유지 |

### 삭제 종합

| 경로 | 사유 |
|------|------|
| `/api/medichecker/*` | 의료광고 검수 |
| `/api/patients/*` | 예약/결제 |
| `/api/payments/*` | 결제 |
| `/api/press/*` | 언론보도 |
| `/api/staff/*` | 직원 관리 |
| `/api/bookings/*` | 예약 |
| `/api/content/*` | 콘텐츠 분석 |
| `/api/erp-documents/*` | 견적/계산서 |
| `/api/qstash/chatbot` | 챗봇 |
| `/api/clinic-treatments` | 시술 카탈로그 |
| `/api/cron/sync-press` | 언론보도 동기화 |
| `/api/dashboard/treatment-revenue` | 시술 매출 |
| `/api/seed` | 시드 데이터 |
| `/api/external/ad-spend` | 외부 API |
| `/api/auth/tiktok/*` | TikTok OAuth (판단 필요 — ads sync 방식에 따라 유지 가능) |

---

## API 수량 요약

| 구분 | 유지 | 수정 | 삭제 | 신규 | 합계 |
|------|------|------|------|------|------|
| Auth | 1 | 1 | 0 | 1 | 3 |
| Dashboard | 3 | 2 | 1 | 1 | 7 |
| Ads | 8 | 0 | 0 | 0 | 8 |
| Campaigns | 1 | 0 | 0 | 0 | 1 |
| Customers | 0 | 4 | 0 | 3 | 7 |
| Attribution | 1 | 2 | 0 | 0 | 3 |
| Monitoring | 4 | 0 | 0 | 0 | 4 |
| UTM | 6 | 0 | 0 | 0 | 6 |
| Admin | 15 | 2 | 0 | 6 | 23 |
| My | 1 | 1 | 0 | 0 | 2 |
| Webhook/LP | 3 | 1 | 0 | 0 | 4 |
| Cron | 1 | 1 | 1 | 0 | 3 |
| 기타 | 3 | 0 | ~15 | 0 | 18 |
| **합계** | **47** | **14** | **~17** | **11** | **~89** |
