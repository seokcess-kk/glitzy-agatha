# 거래처 양방향 동기화 스펙

> glitzy-web ↔ Agatha/Samantha 거래처 연동 규격

## 전체 구조

```
┌─────────────┐     webhook      ┌─────────────┐
│             │ ──────────────→  │             │
│  glitzy-web │                  │   Agatha    │
│  (마스터)    │ ←──────────────  │             │
│             │  거래처 생성/검색  │             │
└─────────────┘                  └─────────────┘
       │
       │          webhook        ┌─────────────┐
       │ ──────────────────────→ │             │
       │                         │  Samantha   │
       └──────────────────────── │             │
                거래처 생성/검색   └─────────────┘
```

### 연동 흐름

| 시나리오 | 흐름 |
|----------|------|
| glitzy-web에서 거래처 생성 | glitzy-web → webhook → Agatha/Samantha에 자동 클라이언트 생성 |
| Agatha에서 클라이언트 생성 | Agatha → `POST /api/external/clients` → glitzy-web에 거래처 생성 → erp_client_id 저장 |
| Samantha에서 클리닉 생성 | Samantha → `POST /api/external/clients` → glitzy-web에 거래처 생성 → erp_client_id 저장 |
| 기존 거래처 연결 | Agatha/Samantha → `GET /api/external/clients` → 검색 → erp_client_id 매핑 |

---

## glitzy-web 구현 필요 사항

### 1. 거래처 목록 API (신규)

```
GET /api/external/clients?search=&page=&limit=
Authorization: Bearer {SERVICE_KEY}
```

**응답:**
```json
{
  "success": true,
  "data": [
    {
      "id": 47,
      "name": "A렌트카",
      "business_number": "123-45-67890",
      "contact_name": "홍길동",
      "contact_phone": "010-1234-5678",
      "contact_email": "hong@example.com",
      "created_at": "2026-04-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 3,
    "totalCount": 25
  }
}
```

**파라미터:**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| search | string (선택) | 거래처명 검색 |
| page | number (선택, 기본 1) | 페이지 번호 |
| limit | number (선택, 기본 50) | 페이지당 건수 |

### 2. 거래처 생성 API (신규)

```
POST /api/external/clients
Authorization: Bearer {SERVICE_KEY}
Content-Type: application/json
```

**요청:**
```json
{
  "name": "A렌트카",
  "business_number": "123-45-67890",
  "contact_name": "홍길동",
  "contact_phone": "010-1234-5678",
  "contact_email": "hong@example.com",
  "source": "agatha"
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "id": 47,
    "name": "A렌트카"
  }
}
```

**필드:**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | 필수 | 거래처명 |
| business_number | string | 선택 | 사업자번호 |
| contact_name | string | 선택 | 담당자명 |
| contact_phone | string | 선택 | 담당자 연락처 |
| contact_email | string | 선택 | 담당자 이메일 |
| source | string | 선택 | 생성 출처 ("agatha" / "samantha") |

**중복 체크:** `name` 또는 `business_number`가 이미 존재하면 409 반환.

### 3. Webhook 발송 (거래처 생성/수정/삭제 시)

glitzy-web에서 거래처 CUD 발생 시 등록된 webhook URL로 POST 요청.

**발송 대상 URL 설정:**
```
# glitzy-web 환경변수 또는 DB 설정
WEBHOOK_URLS=https://glitzy-agatha.vercel.app/api/webhook/erp-client,https://samantha-url/api/webhook/erp-client
WEBHOOK_SECRET={ERP_SERVICE_KEY와 동일}
```

**요청 형식:**
```
POST {WEBHOOK_URL}
Authorization: Bearer {WEBHOOK_SECRET}
Content-Type: application/json
```

**Body:**
```json
{
  "event": "client.created",
  "data": {
    "id": 47,
    "name": "A렌트카",
    "business_number": "123-45-67890",
    "contact_name": "홍길동",
    "contact_phone": "010-1234-5678",
    "contact_email": "hong@example.com"
  },
  "timestamp": "2026-04-17T09:00:00Z"
}
```

**이벤트 유형:**
| event | 시점 | Agatha/Samantha 동작 |
|-------|------|---------------------|
| `client.created` | 거래처 신규 생성 | 클라이언트 자동 생성 (erp_client_id 매핑) |
| `client.updated` | 거래처 정보 수정 | 클라이언트명 동기화 (선택적) |
| `client.deleted` | 거래처 삭제/비활성화 | 클라이언트 비활성화 (is_active=false) |

**Webhook 발송 규칙:**
- fire-and-forget (응답 대기 최대 5초, 실패해도 glitzy-web 동작에 영향 없음)
- 실패 시 1회 재시도 (30초 후)
- 응답 코드 2xx를 성공으로 간주

### 4. 구현 우선순위

| 순서 | API | 이유 |
|------|-----|------|
| 1 | `GET /api/external/clients` | Agatha/Samantha에서 기존 거래처 연결에 필수 |
| 2 | `POST /api/external/clients` | Agatha/Samantha에서 거래처 신규 생성에 필수 |
| 3 | Webhook 발송 | 자동 동기화 (없어도 수동 연결 가능) |

---

## Samantha 구현 필요 사항

Agatha와 동일한 패턴을 Samantha에도 적용합니다.

### 1. DB 변경

```sql
-- clinics 테이블에 erp_client_id 추가
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS erp_client_id INTEGER;
```

현재 Samantha `clinics.id`가 glitzy-web `clinic_id`와 직접 매핑되어 있다면, 기존 데이터 마이그레이션 필요:
```sql
-- 기존 clinics의 id를 erp_client_id로 복사 (1:1 매핑인 경우)
UPDATE clinics SET erp_client_id = id;
```

### 2. Webhook 수신 API (신규)

```
POST /api/webhook/erp-client
Authorization: Bearer {ERP_SERVICE_KEY}
```

Agatha의 `/api/webhook/erp-client`와 동일한 로직:
- `client.created` → clinics 테이블에 자동 생성 (erp_client_id 매핑)
- `client.updated` → 클리닉명 동기화
- `client.deleted` → 비활성화

### 3. erpClient.ts 수정

```typescript
// 기존: clinicId를 직접 clinic_id로 전송
fetchQuotes(clinicId, ...)

// 변경: erp_client_id 값을 clinic_id로 전송
// API route에서 clinics.erp_client_id 조회 후 전달
const clinic = await supabase.from('clinics').select('erp_client_id').eq('id', clinicId).single()
fetchQuotes(clinic.erp_client_id, ...)
```

### 4. 거래처 생성/검색 API (신규)

Agatha와 동일 패턴:
- `GET /api/admin/erp-clients` — glitzy-web 거래처 검색 프록시
- 클리닉 생성 시 `create_erp_client` 옵션으로 glitzy-web 거래처 동시 생성

### 5. 클리닉 관리 UI 수정

클리닉 생성/수정 시 glitzy-web 거래처 연결:
- 기존 거래처 검색/선택
- 새 거래처 생성
- 나중에 연결

### 6. middleware.ts

`/api/webhook/erp-client` 경로 인증 면제 추가.

### 7. 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `supabase/migrations/` | `erp_client_id` 컬럼 추가 마이그레이션 |
| `app/api/webhook/erp-client/route.ts` | 신규 — webhook 수신 |
| `lib/services/erpClient.ts` | `createErpClient`, `fetchErpClients` 함수 추가 |
| `app/api/erp-documents/route.ts` | `erp_client_id` 기반 조회로 변경 |
| `app/api/erp-documents/[id]/route.ts` | 동일 |
| `app/api/erp-documents/[id]/respond/route.ts` | 동일 |
| `app/api/admin/erp-clients/route.ts` | 신규 — 거래처 검색 프록시 |
| `app/api/admin/clinics/route.ts` | 클리닉 생성 시 `create_erp_client` 옵션 |
| `app/(dashboard)/admin/clinics/page.tsx` | 거래처 연결 UI |
| `middleware.ts` | webhook 경로 면제 |

---

## 인증 정리

| 통신 | 인증 방식 | 키 |
|------|----------|-----|
| Agatha → glitzy-web API | `Authorization: Bearer {ERP_SERVICE_KEY}` | Agatha 환경변수 `ERP_SERVICE_KEY` |
| Samantha → glitzy-web API | `Authorization: Bearer {ERP_SERVICE_KEY}` | Samantha 환경변수 `ERP_SERVICE_KEY` |
| glitzy-web → Agatha webhook | `Authorization: Bearer {WEBHOOK_SECRET}` | glitzy-web 환경변수, Agatha `ERP_SERVICE_KEY`와 동일 |
| glitzy-web → Samantha webhook | `Authorization: Bearer {WEBHOOK_SECRET}` | glitzy-web 환경변수, Samantha `ERP_SERVICE_KEY`와 동일 |

**동일한 SERVICE_KEY를 공유하는 게 가장 간단합니다.** 분리하고 싶다면 glitzy-web에서 KEY별 라우팅 필요.

---

*작성일: 2026-04-17*
*버전: 1.0*
