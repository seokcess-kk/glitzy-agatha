# API 라우트 작성 규칙

## 미들웨어 래퍼 선택 (필수)

| 래퍼 | 용도 | 제공 컨텍스트 |
|------|------|--------------|
| `withAuth` | 인증만 필요 | `{ user }` |
| `withClinicFilter` | clinic_id 필터링 (대부분의 API) | `{ user, clinicId, assignedClinicIds }` |
| `withClinicAdmin` | clinic_admin 이상 (clinic_staff 차단) | `{ user, clinicId }` |
| `withSuperAdmin` | superadmin 전용 | `{ user }` |

- 래퍼 없이 직접 export 금지. 반드시 위 중 하나로 감싸야 함
- `import { withClinicFilter, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'`

## 멀티테넌트 필터링 (필수)

```typescript
// SELECT: applyClinicFilter 사용
let query = supabase.from('table').select('*')
const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
if (!filtered) return apiSuccess([])  // agency_staff 배정 병원 0개

// INSERT: clinic_id 명시적 포함
await supabase.from('table').insert({ clinic_id: clinicId, ...data })
```

- `applyClinicFilter`는 agency_staff의 `assignedClinicIds` IN 필터도 자동 처리
- clinic_id 필터 없는 쿼리는 데이터 유출 사고로 이어짐

## 응답 형식

- 성공: `apiSuccess(data)` 또는 `apiSuccess(data, 201)`
- 실패: `apiError('메시지')` 또는 `apiError('메시지', 403)`
- `NextResponse.json()` 직접 사용 금지 → `apiSuccess`/`apiError` 사용

## 입력 검증

```typescript
const id = parseId(params.id)              // 숫자 ID 파싱, 실패 시 null
if (!id) return apiError('유효한 ID가 필요합니다.')

const safeText = sanitizeString(body.text, 1000)  // XSS 방지, 길이 제한
```

- 모든 경로 파라미터: `parseId()` 사용
- 모든 문자열 입력: `sanitizeString()` 사용
- 상태값: `isValidBookingStatus()` 등 화이트리스트 검증

## 활동 추적 (데이터 변경 API)

bookings/payments/consultations/leads를 INSERT/UPDATE하는 API는:
1. `created_by` 또는 `updated_by`에 `user.id` 설정
2. `logActivity(supabase, { userId, clinicId, action, targetTable, targetId, detail })` 호출

## 에러 처리

```typescript
try {
  // ...
} catch (error) {
  logger.error('설명', error, { clinicId })
  return apiError('서버 오류가 발생했습니다.', 500)
}
```

- 사용자에게 내부 에러 상세를 노출하지 않음
- `createLogger('RouteName')`으로 서버 로그에만 상세 기록
