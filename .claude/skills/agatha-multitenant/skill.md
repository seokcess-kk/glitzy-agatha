---
name: agatha-multitenant
description: "Agatha 멀티테넌트 구현 가이드. client_id 기반 데이터 격리, 역할별 접근 제어(superadmin/agency_staff/client_admin/client_staff), 클라이언트 스위처, agency_staff 배정 관리. DB 쿼리를 작성하거나 API를 만들 때, 권한 로직을 구현할 때 반드시 이 스킬을 참조할 것."
---

# Agatha Multitenant Implementation Guide

## 목적

모든 데이터가 client_id로 격리되고, 역할별 접근 제어가 올바르게 동작하도록 보장한다.

## 테넌트 = Client

Agatha에서 테넌트는 **클라이언트(광고주)**. 모든 비즈니스 데이터(리드, 광고 통계, 연락처 등)는 client_id로 격리된다.

## 필수 규칙

### 1. DB 쿼리 격리

```typescript
// 모든 SELECT에 client_id 필터
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('client_id', clientId)  // 필수

// 모든 INSERT에 client_id 포함
await supabase.from('leads').insert({
  client_id: clientId,  // 필수
  ...leadData
})
```

### 2. 역할 체계

| 역할 | 접근 범위 | client_id 동작 |
|------|----------|---------------|
| superadmin | 전체 | URL의 ?client_id=X로 필터, 없으면 전체 |
| agency_staff | 배정된 클라이언트만 | user_client_assignments 테이블 참조 |
| client_admin | 자기 client_id만 | 세션의 client_id 고정 |
| client_staff | 자기 client_id만 | 세션의 client_id 고정 |

### 3. 클라이언트 스위처

superadmin/agency_staff는 사이드바에서 클라이언트를 선택할 수 있다.
선택된 client_id는 `ClientContext`(React Context)로 관리되며, localStorage에 `agatha_selected_client` 키로 저장.

```typescript
// components/ClientContext.tsx
const { selectedClientId, setSelectedClientId, clients } = useClient()
```

### 4. agency_staff 배정

```sql
-- user_client_assignments 테이블
CREATE TABLE user_client_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  UNIQUE(user_id, client_id)
);
```

agency_staff는 이 테이블에 배정된 client_id만 접근 가능. API에서 반드시 검증:

```typescript
// agency_staff 접근 시
const assignedClientIds = await getAssignedClientIds(session.user.id)
if (!assignedClientIds.includes(requestedClientId)) {
  return apiError('접근 권한이 없습니다', 403)
}
```

## 위반 시 영향

client_id 필터 누락 = **클라이언트 간 데이터 유출** → 보안 사고. 모든 코드 리뷰에서 최우선 확인 항목.
