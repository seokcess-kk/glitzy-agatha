# Samantha ↔ glitzy-web ERP 연동 가이드

> 최종 갱신: 2026-03-24
> Phase 1 (읽기 전용): **구현 완료** (프로덕션 배포 확인)
> Phase 2 (견적 승인/반려): **구현 완료** (통합 테스트 대기)

---

## 개요

glitzy-web에서 견적서/계산서를 생성·관리하고, Samantha에서 병원 고객이 자기 병원의 견적서/계산서를 **읽기 전용**으로 조회한다.

```
병원 사용자 (브라우저)
    │
    ▼
Samantha 프론트 (/erp-documents)
    │ fetch('/api/erp-documents')
    ▼
Samantha API (/api/erp-documents)
    │ withClinicFilter → clinicId 추출
    │ erpClient.fetchQuotes(clinicId)
    ▼
glitzy-web 외부 API (/api/external/quotes)
    │ SERVICE_KEY 검증 → clinic_id 필터 → Supabase
    ▼
{ success, data, pagination }
```

- Samantha DB에 ERP 테이블 생성하지 않음 (glitzy-web이 Single Source of Truth)
- Samantha 마이그레이션 불필요
- 인증 분리 유지 (서버 간 SERVICE_KEY 통신만)

---

## glitzy-web 외부 API (구현 완료)

### 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/external/quotes?clinic_id=&status=&page=&limit=` | 견적서 목록 (draft 미노출, 페이지네이션) |
| GET | `/api/external/quotes/:id?clinic_id=` | 견적서 상세 (품목 포함) |
| GET | `/api/external/invoices?clinic_id=&status=&page=&limit=` | 계산서 목록 (페이지네이션) |
| GET | `/api/external/invoices/:id?clinic_id=` | 계산서 상세 |

### 인증

```
Authorization: Bearer {SERVICE_KEY}
```
- timing-safe 비교 (timing attack 방지)
- SERVICE_KEY 미설정 시 500, 불일치 시 401

### 필수 파라미터

`clinic_id` — 모든 요청에 필수. Samantha `clinics.id` 값.
glitzy-web `clients.clinic_id`와 매핑 (1:1 UNIQUE, FK 아닌 논리적 참조).

### 응답 형식

**목록** (`{ success, data, pagination }`):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "quote_number": "QT-202603-001",
      "title": "3월 광고 운영 견적",
      "status": "approved",
      "supply_amount": 5000000,
      "tax_amount": 500000,
      "total_amount": 5500000,
      "valid_until": "2026-04-30",
      "created_at": "2026-03-24T05:00:00Z",
      "sent_at": "2026-03-24T06:00:00Z"
    }
  ],
  "pagination": { "page": 1, "totalPages": 1, "totalCount": 1 }
}
```

**상세** (`{ success, data }`):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "quote_number": "QT-202603-001",
    "title": "3월 광고 운영 견적",
    "status": "approved",
    "supply_amount": 5000000,
    "tax_amount": 500000,
    "total_amount": 5500000,
    "clients": {
      "id": "uuid",
      "name": "강남점",
      "clinic_id": 2
    },
    "quote_items": [
      {
        "description": "Meta 광고 운영",
        "specification": "월간",
        "quantity": 1,
        "unit": "월",
        "unit_price": 3000000,
        "supply_amount": 3000000,
        "tax_amount": 300000,
        "amount": 3300000,
        "sort_order": 0
      }
    ]
  }
}
```

**에러**:
```json
{ "success": false, "error": "clinic_id is required" }
```

### 견적 상태 노출 범위

| 상태 | 노출 | 설명 |
|------|------|------|
| `draft` | X | 내부 작업 중 |
| `sent` | O | 확인 대기 |
| `approved` | O | 승인됨 |
| `converted` | O | 매출 전환됨 |
| `rejected` | O | 반려됨 |

### 계산서 필드

| 필드 | 설명 |
|------|------|
| `type` | `transaction_statement` (거래명세서) / `tax_invoice` (세금계산서) |
| `status` | `issued` (발행됨) / `cancelled` (취소됨) |
| `issue_date` | 발행일 (YYYY-MM-DD) |

---

## Samantha 측 구현 가이드

### 1. 환경변수 추가

```bash
# .env.local
ERP_API_URL=https://glitzy.kr/api/external
ERP_SERVICE_KEY=glitzy_svc_xxxxx    # glitzy-web과 동일한 SERVICE_KEY
```

### 2. ERP 클라이언트 (`lib/services/erpClient.ts`)

기존 `fetchJSON` 패턴 활용. 새 파일 1개만 추가.

> **주의**: `fetchWithRetry`는 `{ response: Response, attempts }` 반환이므로 사용 불가.
> 반드시 `fetchJSON<T>`를 사용할 것 (`{ success, data, error, statusCode, attempts }` 반환).

```typescript
import { fetchJSON } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPClient')

async function erpFetch<T>(path: string): Promise<T> {
  const url = process.env.ERP_API_URL
  const key = process.env.ERP_SERVICE_KEY
  if (!url || !key) {
    throw new Error('ERP_API_URL 또는 ERP_SERVICE_KEY 미설정')
  }

  const result = await fetchJSON<T>(`${url}${path}`, {
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    service: 'ERPClient',
    timeout: 15000,
    retries: 2,
  })

  if (!result.success) {
    logger.error('ERP API 호출 실패', { path, error: result.error, statusCode: result.statusCode })
    throw new Error(result.error || 'ERP API 호출 실패')
  }

  return result.data as T
}

// 견적서 목록
export async function fetchQuotes(clinicId: number, params?: {
  status?: string
  page?: number
  limit?: number
}) {
  const sp = new URLSearchParams({ clinic_id: String(clinicId) })
  if (params?.status) sp.set('status', params.status)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit))

  return erpFetch<{
    success: boolean
    data: ERPQuote[]
    pagination: ERPPagination
  }>(`/quotes?${sp}`)
}

// 견적서 상세
export async function fetchQuoteDetail(clinicId: number, id: string) {
  return erpFetch<{
    success: boolean
    data: ERPQuoteDetail
  }>(`/quotes/${id}?clinic_id=${clinicId}`)
}

// 계산서 목록
export async function fetchInvoices(clinicId: number, params?: {
  status?: string
  page?: number
  limit?: number
}) {
  const sp = new URLSearchParams({ clinic_id: String(clinicId) })
  if (params?.status) sp.set('status', params.status)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit))

  return erpFetch<{
    success: boolean
    data: ERPInvoice[]
    pagination: ERPPagination
  }>(`/invoices?${sp}`)
}

// 계산서 상세
export async function fetchInvoiceDetail(clinicId: number, id: string) {
  return erpFetch<{
    success: boolean
    data: ERPInvoice
  }>(`/invoices/${id}?clinic_id=${clinicId}`)
}
```

### 3. 타입 정의 (`types/erp.ts`)

```typescript
export type ERPQuoteStatus = 'sent' | 'approved' | 'converted' | 'rejected'
export type ERPInvoiceType = 'transaction_statement' | 'tax_invoice'
export type ERPInvoiceStatus = 'issued' | 'cancelled'

export interface ERPQuote {
  id: string
  quote_number: string
  title: string
  status: ERPQuoteStatus
  supply_amount: number
  tax_amount: number
  total_amount: number
  valid_until: string | null
  created_at: string
  sent_at: string | null
}

export interface ERPQuoteItem {
  description: string
  specification: string | null
  quantity: number
  unit: string
  unit_price: number
  supply_amount: number
  tax_amount: number
  amount: number
  sort_order: number
}

export interface ERPQuoteDetail extends ERPQuote {
  clients: { id: string; name: string; clinic_id: number } | null
  quote_items: ERPQuoteItem[]
}

export interface ERPInvoice {
  id: string
  invoice_number: string
  type: ERPInvoiceType
  status: ERPInvoiceStatus
  supply_amount: number
  tax_amount: number
  total_amount: number
  issue_date: string
  created_at: string
}

export interface ERPPagination {
  page: number
  totalPages: number
  totalCount: number
}
```

### 4. API Routes (2개)

**`app/api/erp-documents/route.ts`**

```typescript
import { withClinicFilter } from '@/lib/api-middleware'
import { fetchQuotes, fetchInvoices } from '@/lib/services/erpClient'
import { apiSuccess, apiError } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req, { user, clinicId }) => {
  // clinic_staff 접근 차단 (withClinicFilter는 role 체크 안 함)
  if (user.role === 'clinic_staff') return apiError('Forbidden', 403)
  // clinicId 필수 (glitzy-web API 요구사항)
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'quotes'  // quotes | invoices
  const status = url.searchParams.get('status') || undefined
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  try {
    if (type === 'invoices') {
      const result = await fetchInvoices(clinicId, { status, page, limit })
      return apiSuccess(result)
    }
    const result = await fetchQuotes(clinicId, { status, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 조회 실패', err, { clinicId, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
```

**`app/api/erp-documents/[id]/route.ts`**

```typescript
import { withClinicFilter } from '@/lib/api-middleware'
import { fetchQuoteDetail, fetchInvoiceDetail } from '@/lib/services/erpClient'
import { apiSuccess, apiError } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req, { user, clinicId }) => {
  if (user.role === 'clinic_staff') return apiError('Forbidden', 403)
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()!
  const type = url.searchParams.get('type') || 'quotes'

  // UUID 형식 검증 (ERP ID는 UUID)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return apiError('유효한 문서 ID가 필요합니다.', 400)
  }

  try {
    if (type === 'invoices') {
      const result = await fetchInvoiceDetail(clinicId, id)
      return apiSuccess(result)
    }
    const result = await fetchQuoteDetail(clinicId, id)
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 상세 조회 실패', err, { clinicId, id, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
```

### 5. UI 페이지 (`app/(dashboard)/erp-documents/page.tsx`)

기존 Samantha 대시보드 패턴(헤더 + 탭 + 테이블) 따름.

**구성:**
- 탭: 견적서 / 계산서
- 테이블: 문서번호, 제목(또는 유형), 상태 배지, 금액, 날짜
- 페이지네이션
- 행 클릭 → 상세 다이얼로그 (Sheet 컴포넌트)

**컴포넌트 3개:**
```
components/erp-documents/
├── DocumentTabs.tsx     # 견적서/계산서 탭 전환 + 데이터 fetch
├── QuoteList.tsx        # 견적서 목록 테이블 + 상세 Sheet
└── InvoiceList.tsx      # 계산서 목록 테이블 + 상세 Sheet
```

### 6. 사이드바 메뉴 추가

사이드바 `menuItems` 배열에 추가:
```typescript
{
  name: '견적/계산서',
  href: '/erp-documents',
  icon: FileText,  // lucide-react
}
```

### 7. 역할별 접근 권한

| 역할 | 접근 | 처리 |
|------|------|------|
| `superadmin` | 전체 병원 | `?clinic_id=X`로 필터 |
| `agency_staff` | 배정된 병원만 | `assignedClinicIds` 체크 |
| `clinic_admin` | 자기 병원만 | `session.clinic_id` 자동 |
| `clinic_staff` | **접근 차단** | API 핸들러 내 `user.role` 체크 + 사이드바 `minRole: 2` |

> **주의**: `withClinicFilter`는 role 체크를 하지 않음. clinic_staff 차단은 API 핸들러 내부에서 명시적으로 처리 필요.

---

## 구현 체크리스트 (Samantha)

```
환경변수:
- [x] .env.local에 ERP_API_URL, ERP_SERVICE_KEY 추가 → lib/env.ts optional 그룹

파일 생성 (7개):
- [x] types/erp.ts (타입 정의)
- [x] lib/services/erpClient.ts (fetchJSON 기반 API 호출 래퍼)
- [x] app/api/erp-documents/route.ts (목록 프록시, clinic_staff 차단)
- [x] app/api/erp-documents/[id]/route.ts (상세 프록시, UUID 검증)
- [x] app/(dashboard)/erp-documents/page.tsx (탭 UI + 역할 가드)
- [x] components/erp-documents/quote-list.tsx (견적서 목록 + Sheet 상세)
- [x] components/erp-documents/invoice-list.tsx (계산서 목록 + Sheet 상세)

파일 수정 (2개):
- [x] 사이드바 메뉴에 '견적/계산서' 항목 추가 (Receipt 아이콘)
- [x] agency_staff 메뉴 권한에 'erp-documents' 추가

검증:
- [x] 로컬 환경 동작 확인 (Samantha:3002 → glitzy-web:3000)
- [x] 프로덕션 배포 확인 (samantha → glitzy.kr/api/external)
- [x] Vercel 환경변수 설정 (ERP_API_URL, ERP_SERVICE_KEY)
- [ ] clinic_admin으로 로그인 → 자기 병원 견적서 조회
- [ ] superadmin으로 로그인 → clinic_id 파라미터로 필터
- [ ] clinic_staff로 로그인 → 접근 차단 확인
- [ ] 견적서 상세 → 품목 목록 표시
- [ ] 계산서 탭 전환 → 계산서 목록 표시
- [ ] 페이지네이션 동작
```

---

## 주의사항

- Samantha DB에 ERP 테이블 생성하지 않음 (프록시 방식)
- `toISOString().split('T')[0]` 사용 금지 → `getKstDateString()` 사용 (KST 기준)
- 금액 표시: `toLocaleString('ko-KR')` + '원'
- 네트워크 장애 대비: `fetchWithRetry` 재시도 로직 활용
- glitzy-web 외부 API가 내려가면 에러 UI 표시 (빈 상태가 아닌 명시적 에러)

## Phase 2: 견적서 승인/반려

### 개요

glitzy-web ERP에서 견적서를 발송(`sent`)하면, Samantha에서 병원 admin이 해당 견적서를 승인/반려할 수 있다.

### glitzy-web 새 엔드포인트

```
PATCH /api/external/quotes/:id/respond
Authorization: Bearer {SERVICE_KEY}
```

기존 조회 API(GET /api/external/quotes)와 동일한 인증 방식.

**요청 Body:**
```json
{
  "clinic_id": 2,
  "action": "approve",
  "reason": "단가 조정 필요"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `clinic_id` | number | O | `clinics.id` (소유권 검증에 사용) |
| `action` | string | O | `"approve"` 또는 `"reject"` |
| `reason` | string | X | 반려 사유 (max 1000자, 반려 시 권장) |

**성공 응답 (200):**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "approved" }
}
```

**에러 응답:**

| 코드 | 의미 | 예시 |
|------|------|------|
| 400 | 잘못된 요청 | action 누락, clinic_id 누락 |
| 401 | SERVICE_KEY 불일치 | |
| 404 | 견적서 없음 또는 해당 병원 소유 아님 | |
| 409 | 상태 전이 불가 | 이미 승인/반려된 견적서 |

**상태 전이 규칙:**
- `sent` → `approved` (승인)
- `sent` → `rejected` (반려)
- 그 외 상태에서는 변경 불가 (409)
- `draft` 상태는 외부에 노출되지 않음

### Samantha 측 구현

**변경 파일:**

| 파일 | 변경 | 설명 |
|------|------|------|
| `types/erp.ts` | 수정 | `ERPRespondResult` 타입 추가 |
| `lib/services/erpClient.ts` | 수정 | `respondToQuote()` 함수 추가, `erpFetch` method/body 지원 확장 |
| `app/api/erp-documents/[id]/respond/route.ts` | 신규 | PATCH 프록시, clinic_staff 차단, action 화이트리스트, `logActivity()` |
| `components/erp-documents/quote-list.tsx` | 수정 | Sheet 상세에 승인/반려 버튼, 반려 사유 다이얼로그, 성공 후 목록 새로고침 |

**역할별 접근:**
- `superadmin`: 모든 병원 견적 응답 가능
- `agency_staff`: 배정 병원만
- `clinic_admin`: 자기 병원만
- `clinic_staff`: 차단 (기존과 동일)

**활동 로그:** `logActivity` — `action: 'quote_approved' | 'quote_rejected'`, `targetTable: 'erp_quotes'`

### 테스트

```bash
# 승인
curl -X PATCH https://glitzy.kr/api/external/quotes/{id}/respond \
  -H "Authorization: Bearer {SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clinic_id": 2, "action": "approve"}'

# 반려
curl -X PATCH https://glitzy.kr/api/external/quotes/{id}/respond \
  -H "Authorization: Bearer {SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clinic_id": 2, "action": "reject", "reason": "단가 재협의 필요"}'

# 이미 처리된 건 → 409
# 다른 병원 건 → 404
```

### 요약

| 항목 | 내용 |
|------|------|
| 환경변수 | 추가 없음 (기존 `ERP_SERVICE_KEY` 사용) |
| 새 파일 | 1개 (`app/api/erp-documents/[id]/respond/route.ts`) |
| 수정 파일 | 3개 (`types/erp.ts`, `erpClient.ts`, `quote-list.tsx`) |
| DB 변경 | 없음 |