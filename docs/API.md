# Samantha API 문서

## 개요

Samantha 대시보드의 REST API 엔드포인트 문서입니다.
모든 API는 NextAuth.js 인증이 필요하며, 멀티테넌트 환경에서 `clinic_id` 기반 데이터 격리를 지원합니다.

---

## 인증

### 세션 기반 인증
- NextAuth.js Credentials Provider 사용
- JWT 전략 (세션 토큰)
- 쿠키: `next-auth.session-token`

### 역할 (Role)
| 역할 | 권한 |
|------|------|
| `superadmin` | 전체 병원 데이터 접근, 병원/계정 관리 |
| `agency_staff` | 배정된 병원 데이터 접근, 계정별 메뉴 권한 제한 |
| `clinic_admin` | 자신의 clinic_id 데이터만 접근 |
| `clinic_staff` | 예약/결제, 고객, 리드, 챗봇만 접근 |

---

## 공통 파라미터

### 타임존
- 모든 날짜/시간은 **KST (Asia/Seoul, UTC+9)** 기준으로 처리됩니다.
- DB에는 UTC ISO 문자열로 저장되지만, 날짜 경계 계산(오늘/어제, 기간 필터 등)은 KST 기준입니다.
- `startDate`/`endDate` 미지정 시 기본값도 KST 기준으로 계산됩니다.

### Query Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `clinic_id` | number | 병원 ID (superadmin, agency_staff 사용 가능) |
| `startDate` | string | 시작일 (ISO 8601, KST 기준 00:00:00) |
| `endDate` | string | 종료일 (ISO 8601, KST 기준 23:59:59) |

---

## 대시보드 API

### GET /api/dashboard/kpi

전체 KPI 지표 + 오늘 요약을 조회합니다.

**Query Parameters:**
- `startDate` (optional): 시작일
- `endDate` (optional): 종료일 (기본: 최근 30일)
- `compare` (optional): `true`이면 전기 대비 변화율 포함
- `clinic_id` (optional): 병원 ID

**Response:**
```json
{
  "cpl": 15000,
  "roas": 3.5,
  "bookingRate": 25.5,
  "totalRevenue": 50000000,
  "totalLeads": 150,
  "totalSpend": 5000000,
  "totalConsultations": 45,
  "cac": 250000,
  "arpc": 1500000,
  "payingCustomerCount": 20,
  "today": {
    "leads": 5,
    "bookings": 3,
    "revenue": 3000000,
    "leadsDiff": 2,
    "bookingsDiff": -1,
    "revenueDiff": 500000
  },
  "totalClicks": 5000,
  "totalImpressions": 100000,
  "cpc": 1000,
  "ctr": 5.0,
  "comparison": {
    "cpl": -12.5,
    "roas": 8.3,
    "bookingRate": 5.0,
    "totalRevenue": 15.2,
    "totalLeads": 10.0,
    "totalConsultations": 7.5,
    "totalSpend": -3.2,
    "cac": -8.1,
    "arpc": 12.0,
    "cpc": -5.2,
    "ctr": 3.1
  }
}
```

> `today`: 항상 포함 (KST 기준 오늘 00:00~23:59 + 전일 대비 증감)
> `comparison`: `compare=true`일 때만 포함 (전기 대비 변화율 %)
> 기본 기간: KST 기준 최근 30일 (startDate/endDate 미지정 시)

### GET /api/dashboard/channel

채널별 KPI를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
[
  {
    "channel": "Meta",
    "leads": 80,
    "spend": 3000000,
    "revenue": 30000000,
    "payingCustomers": 12,
    "clicks": 5200,
    "impressions": 120000,
    "cpl": 37500,
    "roas": 10.0,
    "ctr": 4.33,
    "conversionRate": 15.0
  }
]
```

### GET /api/dashboard/campaign

캠페인별 KPI를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`
- `channel` (optional): 특정 채널 필터

**Response:**
```json
[
  {
    "campaign": "spring_promo_2024",
    "channel": "Meta",
    "leads": 50,
    "bookings": 20,
    "payingCustomers": 8,
    "spend": 1500000,
    "revenue": 15000000,
    "clicks": 5000,
    "impressions": 100000,
    "cpl": 30000,
    "roas": 10.0,
    "roasPercent": 1000,
    "bookingRate": 40.0,
    "conversionRate": 16.0,
    "ctr": 5.0
  }
]
```

### GET /api/dashboard/funnel

퍼널 분석 데이터를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`
- `groupBy` (optional): `total` | `channel` | `campaign`

**Response:**
```json
{
  "type": "total",
  "funnel": {
    "stages": [
      { "stage": "Lead", "label": "리드", "count": 150, "rate": 100, "dropoff": 0 },
      { "stage": "Booking", "label": "예약", "count": 60, "rate": 40.0, "dropoff": 60.0 },
      { "stage": "Visit", "label": "방문", "count": 45, "rate": 30.0, "dropoff": 25.0 },
      { "stage": "Consultation", "label": "상담", "count": 40, "rate": 26.7, "dropoff": 11.1 },
      { "stage": "Payment", "label": "결제", "count": 20, "rate": 13.3, "dropoff": 50.0 }
    ],
    "totalConversionRate": 13.3,
    "summary": { "leads": 150, "payments": 20 }
  }
}
```

### GET /api/dashboard/treatment-revenue

시술별 매출 비중을 조회합니다. `payments` 테이블에서 `payment_date` 기준으로 직접 집계합니다 (KPI 매출과 동일 기준).

**Query Parameters:**
- `startDate` (required): 시작일
- `endDate` (required): 종료일
- `clinic_id`

**Response:**
```json
[
  { "name": "보톡스", "amount": 5000000 },
  { "name": "필러", "amount": 3000000 }
]
```

### GET /api/dashboard/trend

주별 트렌드 데이터를 조회합니다. 광고비와 리드 수를 KST 기준 주 단위로 집계합니다.

**Query Parameters:**
- `startDate` (optional): 시작일 (기본: 8주 전)
- `clinic_id`

**Response:**
```json
[
  {
    "week": "2026-03-08T15:00:00.000Z",
    "spend": 5000000,
    "campaigns": 3,
    "leads": 45
  }
]
```

> `week`: 해당 주 시작일 (일요일) UTC ISO 문자열. 클라이언트에서 KST 변환하여 표시

---

## 광고 API

### GET /api/ads/stats

광고 캠페인 통계 + campaign_id별 리드 수를 조회합니다.

**Query Parameters:**
- `days`: 조회 일수
- `clinic_id`
- `platform`: 매체 필터 (선택)

**Response:**
```json
{
  "stats": [
    {
      "id": 1,
      "platform": "Meta",
      "campaign_id": "123456",
      "campaign_name": "캠페인명",
      "stat_date": "2026-03-15",
      "spend_amount": 100000,
      "clicks": 500,
      "impressions": 10000
    }
  ],
  "campaignLeadCounts": {
    "123456": 15
  }
}
```

### POST /api/ads/sync

광고 데이터를 외부 API에서 동기화합니다.

**Request Body:**
```json
{
  "platform": "all" | "meta" | "google" | "tiktok"
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "meta": 15,
    "google": 10,
    "tiktok": 5
  }
}
```

### GET /api/ads/efficiency-trend

일별 광고 효율 추이(CPL·CPC·CTR)를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate` (기본: 최근 28일)
- `clinic_id`

**Response:**
```json
[
  {
    "date": "2026-03-15",
    "spend": 500000,
    "clicks": 250,
    "impressions": 10000,
    "leads": 12,
    "cpl": 41667,
    "cpc": 2000,
    "ctr": 2.5
  }
]
```

### GET /api/ads/platform-summary

매체별 종합 성과 비교를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
[
  {
    "channel": "Meta",
    "spend": 3000000,
    "clicks": 1500,
    "impressions": 50000,
    "leads": 80,
    "revenue": 30000000,
    "payingCustomers": 12,
    "cpl": 37500,
    "cpc": 2000,
    "ctr": 3.0,
    "roas": 10.0,
    "conversionRate": 15.0
  }
]
```

### GET /api/ads/day-analysis

요일별 리드·광고비·CPL을 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
{
  "byDay": [
    { "day": 0, "dayLabel": "일", "leads": 5, "spend": 200000, "cpl": 40000 },
    { "day": 1, "dayLabel": "월", "leads": 15, "spend": 500000, "cpl": 33333 }
  ]
}
```

> `day`: 0(일)~6(토). 리드는 KST 기준 요일 집계, 광고비는 stat_date 기준.

### GET /api/ads/landing-page-performance

랜딩페이지별 리드→결제 전환 성과를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
{
  "pages": [
    {
      "landingPageId": 1,
      "name": "봄 프로모션 LP",
      "isActive": true,
      "leads": 50,
      "customers": 8,
      "revenue": 12000000,
      "conversionRate": 16.0
    }
  ]
}
```

### GET /api/ads/creatives-performance

소재(utm_content)별 광고 지표 + 리드/전환/매출 통합 성과를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
{
  "creatives": [
    {
      "utm_content": "onda_39",
      "name": "온다 39만원",
      "platform": "Meta",
      "spend": 500000,
      "clicks": 120,
      "impressions": 8000,
      "cpc": 4167,
      "ctr": 1.5,
      "cpl": 25000,
      "leads": 20,
      "customers": 3,
      "revenue": 1170000,
      "conversionRate": 15.0,
      "registered": true,
      "file_name": "onda_39.jpg",
      "file_type": "image/jpeg",
      "campaign_ids": ["123456789"]
    }
  ]
}
```

**데이터 소스:**
- `ad_stats` (utm_content별 spend/clicks/impressions) — Meta ad 레벨 수집
- `leads` (utm_content별 리드 수)
- `ad_creatives` (소재 메타데이터 — 수동 등록)
- `payments` (고객 결제/매출 — 리드 기준 귀속)

---

## 리드/고객 API

### GET /api/leads

리드 목록을 조회합니다.

**Query Parameters:**
- `clinic_id`

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "utm_source": "meta",
    "utm_campaign": "spring_promo",
    "chatbot_sent": true,
    "created_at": "2024-01-15T10:30:00Z",
    "customer": {
      "name": "홍길동",
      "phone_number": "010-1234-5678",
      "first_source": "Meta"
    }
  }
]
```

### POST /api/webhook/lead

외부에서 리드를 등록합니다 (웹훅).

**Request Body:**
```json
{
  "name": "홍길동",
  "phoneNumber": "010-1234-5678",
  "utm_source": "meta",
  "utm_medium": "cpc",
  "utm_campaign": "spring_promo",
  "utm_content": "banner_v1",
  "utm_term": "성형외과",
  "inflowUrl": "https://...",
  "clinic_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "leadId": 123,
  "customerId": 456,
  "isNewCustomer": true,
  "utm": { "utm_source": "meta", "utm_campaign": "spring_promo" }
}
```

---

## 예약/결제 API

### GET /api/bookings

예약 목록을 조회합니다.

**Query Parameters:**
- `clinic_id`

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "status": "confirmed",
    "booking_datetime": "2024-01-20T14:00:00Z",
    "notes": "메모",
    "customer": {
      "name": "홍길동",
      "phone_number": "010-1234-5678",
      "consultations": [...],
      "payments": [...]
    }
  }
]
```

### PUT /api/bookings

예약 정보를 수정합니다.

**Request Body:**
```json
{
  "id": 1,
  "status": "visited",
  "booking_datetime": "2024-01-20T14:00:00Z",
  "notes": "메모 수정"
}
```

### PUT /api/patients/{id}/consultation

상담 기록을 저장합니다.

**Request Body:**
```json
{
  "status": "방문완료",
  "notes": "상담 내용",
  "consultationDate": "2024-01-20"
}
```

### POST /api/patients/{id}/payment

결제 내역을 등록합니다.

**Request Body:**
```json
{
  "treatmentName": "쌍꺼풀",
  "paymentAmount": 1500000,
  "paymentDate": "2024-01-20"
}
```

---

## 콘텐츠 API

### GET /api/content/posts

콘텐츠 목록을 조회합니다.

### POST /api/content/posts

콘텐츠를 등록합니다.

### PUT /api/content/posts

콘텐츠 통계를 업데이트합니다.

### GET /api/content/analytics

콘텐츠 분석 데이터를 조회합니다.

**Query Parameters:**
- `groupBy`: `platform` | `campaign` | `month` | `post`
- `clinic_id`

### POST /api/content/audit

콘텐츠 의료광고법 위반 검사를 실행합니다.

---

## 언론보도 API

### GET /api/press

언론보도 목록을 조회합니다.

**Query Parameters:**
- `clinic_id` (optional)

**Response:**
```json
[
  {
    "id": 1,
    "clinic_id": 1,
    "title": "신사세레아의원, 리뉴얼 오픈",
    "source": "조선일보",
    "url": "https://...",
    "published_at": "2026-03-20T03:00:00Z",
    "collected_at": "2026-03-20T09:00:00Z",
    "keyword_id": 1
  }
]
```

### POST /api/press/sync

Google 뉴스에서 키워드별 언론보도를 수집합니다.
`press_keywords`에 등록된 활성 키워드별로 RSS 검색. 키워드 미등록 시 병원명으로 폴백.

**Query Parameters:**
- `clinic_id` (optional): 특정 병원만 수집

### GET /api/press/keywords

언론보도 검색 키워드 목록을 조회합니다.

**Query Parameters:**
- `clinic_id` (optional)

**Response:**
```json
[
  {
    "id": 1,
    "clinic_id": 1,
    "keyword": "신사세레아의원",
    "is_active": true,
    "created_by": 1,
    "created_at": "2026-03-20T00:00:00Z"
  }
]
```

### POST /api/press/keywords

언론보도 검색 키워드를 등록합니다. 병원당 최대 5개.

**Request Body:**
```json
{
  "clinic_id": 1,
  "keyword": "신사세레아의원"
}
```

### DELETE /api/press/keywords

언론보도 검색 키워드를 삭제합니다. 삭제 전 `deleted_records`에 스냅샷 보관.

**Request Body:**
```json
{
  "id": 1
}
```

---

## 관리자 API (superadmin 전용)

### GET /api/admin/clinics

병원 목록을 조회합니다.

### POST /api/admin/clinics

병원을 등록합니다.

**Request Body:**
```json
{
  "name": "미래성형외과",
  "slug": "mirae"
}
```

### GET /api/admin/users

사용자 목록을 조회합니다.

### POST /api/admin/users

사용자를 생성합니다.

**Request Body (clinic_admin/clinic_staff):**
```json
{
  "username": "admin_mirae",
  "password": "초기비밀번호",
  "role": "clinic_admin",
  "clinic_id": 1
}
```

**Request Body (agency_staff):**
```json
{
  "username": "agency_kim",
  "password": "초기비밀번호",
  "role": "agency_staff",
  "assigned_clinic_ids": [1, 2, 3],
  "menu_permissions": ["dashboard", "monitoring", "monitoring-input"]
}
```

### GET /api/admin/users/{id}/permissions

agency_staff 계정의 병원 배정 및 메뉴 권한을 조회합니다.

**Response:**
```json
{
  "assigned_clinic_ids": [1, 2],
  "menu_permissions": ["dashboard", "monitoring"]
}
```

### PUT /api/admin/users/{id}/permissions

agency_staff 계정의 병원 배정 및 메뉴 권한을 수정합니다.

**Request Body:**
```json
{
  "assigned_clinic_ids": [1, 2, 3],
  "menu_permissions": ["dashboard", "campaigns", "monitoring", "monitoring-input"]
}
```

### POST /api/admin/backfill-ads

특정 병원의 과거 광고 데이터를 일괄 수집합니다 (최대 90일). `CRON_SECRET` Bearer 토큰 인증.

**Request Body:**
```json
{
  "clinicId": 19,
  "startDate": "2026-03-01",
  "endDate": "2026-03-25"
}
```

**Response:**
```json
{
  "clinicId": 19,
  "syncedDays": 25,
  "totalCount": 12,
  "errorCount": 0,
  "results": [
    { "date": "2026-03-13", "platform": "Meta", "count": 1, "error": null },
    { "date": "2026-03-14", "platform": "Meta", "count": 1, "error": null }
  ]
}
```

**참고:**
- `maxDuration: 300` (5분 타임아웃, Vercel Pro 기준)
- 해당 clinic의 `clinic_api_configs`에 등록된 매체를 날짜별 순차 동기화
- 캠페인 레벨(`ad_campaign_stats`) + ad 레벨(`ad_stats`) 동시 수집
- ad 레벨은 Meta creative의 `url_tags`/`effective_link`에서 `utm_content` 자동 추출
- 결과는 upsert (중복 safe)

---

### GET /api/auth/tiktok

TikTok OAuth2 인증을 시작합니다. TikTok 인증 페이지로 리다이렉트됩니다.

**권한:** `superadmin`

**Query Parameters:**
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `clinic_id` | ✓ | 연동할 병원 ID |

**흐름:**
1. CSRF state 토큰 생성 → `oauth_states` 테이블에 저장 (10분 만료)
2. TikTok 인증 페이지로 리다이렉트 (`business-api.tiktok.com/portal/auth`)
3. 광고주가 승인하면 `/api/auth/tiktok/callback`으로 리다이렉트

**환경변수 필요:** `TIKTOK_APP_ID`

### GET /api/auth/tiktok/callback

TikTok OAuth2 콜백. auth_code를 수신하여 access_token으로 교환 후 `clinic_api_configs`에 저장합니다.

**인증:** 불필요 (TikTok 리다이렉트 — CSRF state 토큰으로 검증)

**Query Parameters (TikTok 제공):**
| 파라미터 | 설명 |
|----------|------|
| `auth_code` | TikTok 인증 코드 |
| `state` | base64url 인코딩된 `{ clinicId, csrfToken }` |

**처리:**
1. state 디코딩 → `oauth_states` DB 검증 (CSRF 방지 + 만료 확인)
2. auth_code → TikTok API로 access_token + refresh_token 교환
3. `clinic_api_configs`에 암호화 저장 (advertiser_id, access_token, refresh_token, 만료일시)
4. `/admin/settings?success=tiktok_connected`로 리다이렉트

**환경변수 필요:** `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`

**에러 리다이렉트:**
| Query Parameter | 원인 |
|-----------------|------|
| `error=tiktok_denied` | 사용자가 인증 거부 |
| `error=tiktok_invalid_state` | CSRF state 불일치/파싱 실패 |
| `error=tiktok_state_expired` | state 만료 (10분 초과) |
| `error=tiktok_token_error` | 토큰 교환 실패 |
| `error=tiktok_no_advertiser` | 인증 성공했으나 연결된 광고주 계정 없음 |

---

## 내 정보 API

### GET /api/my/clinics

현재 로그인 사용자의 접근 가능 병원 목록을 조회합니다.
- superadmin: 전체 활성 병원
- agency_staff: 배정된 병원만
- clinic_admin/staff: 자기 병원만

### GET /api/my/menu-permissions

현재 로그인 사용자의 메뉴 권한을 조회합니다.

**Response:**
```json
{
  "all": false,
  "permissions": ["dashboard", "monitoring", "monitoring-input"]
}
```

---

## 순위 모니터링 API

### GET /api/monitoring/keywords

모니터링 키워드 목록을 조회합니다.

**Query Parameters:**
- `clinic_id` (optional)
- `active_only` (optional): `true`이면 활성 키워드만

**Response:**
```json
[
  {
    "id": 1,
    "clinic_id": 1,
    "keyword": "강남 성형외과",
    "category": "place",
    "is_active": true
  }
]
```

### POST /api/monitoring/keywords (superadmin/agency_staff)

키워드를 등록합니다.

**Request Body:**
```json
{
  "clinic_id": 1,
  "keyword": "강남 성형외과",
  "category": "place"
}
```

### PATCH /api/monitoring/keywords (superadmin/agency_staff)

키워드를 수정합니다.

**Request Body:**
```json
{
  "id": 1,
  "is_active": false
}
```

### DELETE /api/monitoring/keywords (superadmin/agency_staff)

키워드를 삭제합니다. 관련 순위 데이터도 CASCADE 삭제. 삭제 전 `deleted_records`에 스냅샷 보관.

**Request Body:**
```json
{
  "id": 1
}
```

### GET /api/monitoring/rankings

월간 순위 데이터를 조회합니다.

**Query Parameters:**
- `month` (필수): `YYYY-MM`
- `category` (optional): `place` | `website` | `smartblock` | `related`
- `clinic_id` (optional)

**Response:**
```json
{
  "keywords": [
    { "id": 1, "keyword": "강남 성형외과", "category": "place", "clinic_id": 1 }
  ],
  "rankings": [
    { "keyword_id": 1, "rank_date": "2026-03-01", "rank_position": 3, "url": null }
  ]
}
```

### POST /api/monitoring/rankings

단건 순위를 입력합니다 (UPSERT).

**Request Body:**
```json
{
  "keyword_id": 1,
  "rank_date": "2026-03-16",
  "rank_position": 3,
  "url": "https://..."
}
```

### POST /api/monitoring/rankings/bulk

일괄 순위를 입력합니다 (UPSERT, 최대 200개).

**Request Body:**
```json
{
  "rankings": [
    { "keyword_id": 1, "rank_date": "2026-03-16", "rank_position": 3 },
    { "keyword_id": 2, "rank_date": "2026-03-16", "rank_position": 5, "url": "https://..." }
  ]
}
```

---

## Cron API

### POST /api/cron/sync-ads
광고 데이터 자동 동기화 (매일 03:00)

### POST /api/cron/sync-press
언론보도 자동 수집 (매일 00:00)

**인증:**
```
Authorization: Bearer $CRON_SECRET
```

---

## 원고 검수 API (MediChecker)

### POST /api/medichecker/verify

의료광고법 제56조 기반 광고 텍스트 위반 검증 (SSE 스트리밍).

**권한:** clinic_admin 이상 (clinic_staff 차단)

**Request Body:**
```json
{
  "text": "검증할 광고 텍스트",
  "adType": "blog"
}
```

- `text`: 필수, 최대 5000자 (sanitizeString 적용)
- `adType`: `blog` | `instagram` | `youtube` | `other`

**Response:** Server-Sent Events (SSE) 스트리밍

진행 이벤트:
```
data: {"type":"progress","stage":"keyword_scan","status":"running"}
data: {"type":"progress","stage":"keyword_scan","status":"done"}
data: {"type":"progress","stage":"classification","status":"running"}
...
```

결과 이벤트:
```
data: {"type":"result","result":{"violations":[...],"riskScore":75,"summary":"...","metadata":{...}}}
```

에러 이벤트:
```
data: {"type":"error","error":"에러 메시지"}
```

**7단계 파이프라인:**
1. 키워드 스캔 (regex, ~50ms)
2. 컨텍스트 분류 (Claude Haiku)
3. 쿼리 변환 (Claude Haiku)
4. RAG 하이브리드 검색 (pgvector + pg_trgm)
5. 온톨로지 관계 확장 (1홉)
6. 위반 판단 (Claude Sonnet)
7. 자기 검증 (Claude Sonnet)

> `maxDuration = 120`. 결과는 `mc_verification_logs`에 자동 저장.

### GET /api/medichecker/history

검증 이력 목록 조회 (페이지네이션).

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `clinic_id`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "clinic_id": 1,
      "user_id": 1,
      "ad_type": "blog",
      "risk_score": 75,
      "violation_count": 3,
      "summary": "3건의 위반 의심 항목 발견",
      "processing_time_ms": 8500,
      "created_at": "2026-03-24T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET /api/medichecker/history/{id}

검증 이력 단건 상세 조회.

**Response:**
```json
{
  "id": 1,
  "clinic_id": 1,
  "user_id": 1,
  "ad_text": "원본 광고 텍스트",
  "ad_type": "blog",
  "risk_score": 75,
  "violation_count": 3,
  "violations": [...],
  "summary": "...",
  "metadata": {...},
  "processing_time_ms": 8500,
  "created_at": "2026-03-24T10:30:00Z"
}
```

---

## ERP 문서 API (견적서/계산서)

glitzy-web 외부 API 프록시. 읽기 전용.

**권한:** clinic_admin 이상 (clinic_staff 차단). clinicId 필수.

### GET /api/erp-documents

견적서 또는 계산서 목록을 조회합니다.

**Query Parameters:**
- `type`: `quotes` (기본) | `invoices`
- `status` (optional): 상태 필터
- `page` (default: 1)
- `limit` (default: 20)
- `clinic_id`: 병원 ID (필수)

**Response:** glitzy-web 응답을 그대로 전달
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "totalPages": 3, "totalCount": 42 }
}
```

### GET /api/erp-documents/{id}

견적서 또는 계산서 상세를 조회합니다. ID는 UUID 형식.

**Query Parameters:**
- `type`: `quotes` (기본) | `invoices`
- `clinic_id`: 병원 ID (필수)

**Response:**
```json
{
  "success": true,
  "data": { "id": "uuid", "quote_number": "QT-202603-001", "title": "...", "quote_items": [...] }
}
```

### PATCH /api/erp-documents/{id}/respond

견적서를 승인 또는 반려합니다. `sent` 상태에서만 가능.

**Query Parameters:**
- `clinic_id`: 병원 ID (필수)

**Request Body:**
```json
{
  "action": "approve",
  "reason": "반려 사유 (reject 시 선택)"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `action` | string | O | `approve` 또는 `reject` |
| `reason` | string | X | 반려 사유 (max 1000자) |

**Response (성공):**
```json
{
  "success": true,
  "data": { "success": true, "data": { "id": "uuid", "status": "approved" } }
}
```

**에러:** 400 (잘못된 요청), 403 (clinic_staff), 409 (상태 전이 불가), 500 (서버 오류)

---

## 병원 API 키 관리 API (superadmin 전용)

### GET /api/admin/clinics/{id}/api-configs

병원의 매체별 API 키 설정을 조회합니다.

### PUT /api/admin/clinics/{id}/api-configs

병원의 매체별 API 키 설정을 저장/수정합니다.

### POST /api/admin/clinics/{id}/api-configs/test

매체별 API 키 연결 테스트를 실행합니다.

### GET /api/menu-visibility

인증된 사용자가 시스템 전역 숨김 메뉴 목록을 조회합니다.

**권한**: 인증 필요 (모든 역할)

**응답**:
```json
{ "hiddenMenus": ["content", "monitor"] }
```

### GET /api/admin/menu-settings

슈퍼어드민이 숨김 메뉴 설정을 조회합니다.

**권한**: superadmin

**응답**:
```json
{ "hiddenMenus": ["content", "monitor"] }
```

### PUT /api/admin/menu-settings

슈퍼어드민이 숨김 메뉴 설정을 업데이트합니다.

**권한**: superadmin

**요청**:
```json
{ "hiddenMenus": ["content", "monitor"] }
```

**응답**:
```json
{ "hiddenMenus": ["content", "monitor"] }
```

유효한 메뉴 키: `dashboard`, `campaigns`, `leads`, `patients`, `chatbot`, `ads`, `content`, `monitor`, `press`, `monitoring`, `medichecker`, `erp-documents`

---

## 공개 페이지 (인증 불필요)

| 경로 | 설명 |
|------|------|
| `/privacy` | 개인정보처리방침 |
| `/terms` | 서비스 이용약관 |

---

## 외부 API (서비스 간 통신)

glitzy-web 등 외부 서비스에서 Samantha 데이터를 조회하는 API.
인증: `Authorization: Bearer {EXTERNAL_SERVICE_KEY}` (NextAuth 세션 불필요)

### GET /api/external/ad-spend

병원별 월간 광고 실집행비 + SMS 발송 건수를 조회합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `month` | string | O | YYYY-MM (예: 2026-03) |
| `clinic_id` | number | X | 병원 ID. 생략 시 전체 병원 리스트 |

**응답 (특정 병원):**
```json
{
  "month": "2026-03",
  "clinic_id": 5,
  "clinic_name": "A병원",
  "total_spend": 2800000,
  "platforms": [
    { "platform": "meta", "spend": 1500000, "clicks": 3200, "impressions": 45000 },
    { "platform": "google", "spend": 800000, "clicks": 1800, "impressions": 22000 }
  ],
  "sms_count": 47
}
```

**응답 (전체 병원):**
```json
{
  "month": "2026-03",
  "clinics": [
    { "clinic_id": 5, "clinic_name": "A병원", "total_spend": 2800000, "platforms": [...], "sms_count": 47 },
    { "clinic_id": 8, "clinic_name": "B병원", "total_spend": 1200000, "platforms": [...], "sms_count": 23 }
  ],
  "grand_total": 4000000,
  "total_sms": 70
}
```

---

## 에러 응답

### 공통 에러 형식
```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE"
}
```

---

## 매출 귀속 — ROAS 추이

### `GET /api/attribution/roas-trend`

채널별 일별 ROAS 추이를 조회합니다. 퍼스트터치 기준으로 매출을 채널에 귀속합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|:----:|------|
| `startDate` | string | X | YYYY-MM-DD (기본: 30일 전) |
| `endDate` | string | X | YYYY-MM-DD (기본: 오늘) |
| `clinic_id` | number | X | 병원 필터 |

**응답:**

```json
[
  {
    "date": "2026-03-15",
    "channels": {
      "Meta": { "spend": 50000, "revenue": 150000, "roas": 3.0 },
      "Google": { "spend": 30000, "revenue": 60000, "roas": 2.0 }
    }
  }
]
```

---

### HTTP 상태 코드
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 에러 |
