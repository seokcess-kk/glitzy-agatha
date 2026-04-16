# Samantha 거래처 선택 UI 구현 가이드

> Agatha에서 구현 완료된 거래처 선택 로직을 Samantha에 동일하게 적용하기 위한 가이드

## 개요

클리닉(병원) 등록 시 glitzy-web 거래처를 드롭다운 목록에서 선택할 수 있게 합니다.
선택하면 클리닉명이 자동 입력되고, `erp_client_id`가 매핑됩니다.

## 사전 작업

### 1. DB 마이그레이션

```sql
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS erp_client_id TEXT;
```

### 2. erpClient.ts에 함수 추가

```typescript
// glitzy-web 거래처 목록 조회
export async function fetchErpClients(params?: {
  search?: string; page?: number; limit?: number
}): Promise<{
  data: Array<{ id: string; name: string; branch_name?: string | null; business_number?: string }>;
  pagination: { page: number; totalPages: number; totalCount: number }
}> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.limit) sp.set('limit', String(params.limit || 100))
  return erpFetch(`/clients?${sp}`)
}

// glitzy-web에 거래처 생성
export async function createErpClient(data: {
  name: string
  business_number?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
}): Promise<{ id: string; name: string }> {
  return erpFetch('/clients', {
    method: 'POST',
    body: JSON.stringify({ ...data, source: 'samantha' }),
  }).then(res => res.data)
}
```

### 3. 거래처 검색 프록시 API (신규)

**`app/api/admin/erp-clients/route.ts`:**

```typescript
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchErpClients } from '@/lib/services/erpClient'

export const GET = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') || undefined
  const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined

  try {
    const result = await fetchErpClients({ search, page, limit })
    return apiSuccess(result)
  } catch (err: any) {
    return apiError(err.message || 'glitzy-web 거래처 조회 실패', 502)
  }
})
```

## 클리닉 관리 페이지 수정

### 핵심 변경 사항

`app/(dashboard)/admin/clinics/page.tsx`에서 클리닉 등록 다이얼로그를 수정합니다.

### 1. 타입 및 유틸 함수 추가

```typescript
type ErpLinkMode = 'select' | 'create' | 'later'

interface ErpSearchResult {
  id: string
  name: string
  branch_name?: string | null
  business_number?: string
}

function erpDisplayName(item: ErpSearchResult): string {
  return item.branch_name ? `${item.name} (${item.branch_name})` : item.name
}
```

### 2. state 추가

```typescript
// ERP 거래처 연결
const [erpLinkMode, setErpLinkMode] = useState<ErpLinkMode>('select')
const [erpClients, setErpClients] = useState<ErpSearchResult[]>([])
const [erpClientsLoading, setErpClientsLoading] = useState(false)
const [selectedErpClient, setSelectedErpClient] = useState<ErpSearchResult | null>(null)
const [erpCreateData, setErpCreateData] = useState({
  business_number: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
})
const erpClientsLoadedRef = useRef(false)
```

### 3. 거래처 목록 로드 함수

```typescript
const loadErpClients = useCallback(async () => {
  if (erpClientsLoadedRef.current) return
  setErpClientsLoading(true)
  try {
    const all: ErpSearchResult[] = []
    let page = 1
    while (true) {
      const res = await fetch(`/api/admin/erp-clients?page=${page}&limit=100`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      const items = json?.data?.data || json?.data || []
      if (Array.isArray(items)) all.push(...items)
      const pagination = json?.data?.pagination
      if (!pagination || page >= pagination.totalPages) break
      page++
    }
    setErpClients(all)
    erpClientsLoadedRef.current = true
  } catch {
    toast.error('glitzy-web 거래처 목록을 불러올 수 없습니다.')
  } finally {
    setErpClientsLoading(false)
  }
}, [])
```

### 4. 리셋 함수

```typescript
const resetErpForm = () => {
  setErpLinkMode('select')
  setSelectedErpClient(null)
  setErpCreateData({ business_number: '', contact_name: '', contact_phone: '', contact_email: '' })
}
```

### 5. 다이얼로그 열기 버튼

```tsx
<Button onClick={() => { setDialogOpen(true); loadErpClients() }}>
  신규 클리닉 등록
</Button>
```

### 6. 다이얼로그 내부 — 거래처 선택 UI (전체 코드)

아래 JSX를 클리닉 등록 폼의 적절한 위치에 삽입합니다:

```tsx
{/* glitzy-web 거래처 연결 */}
<div className="space-y-3">
  <Label className="text-xs text-muted-foreground">glitzy-web 거래처 연결</Label>
  <div className="flex gap-1">
    {([
      { value: 'select' as ErpLinkMode, label: '거래처 선택' },
      { value: 'create' as ErpLinkMode, label: '새로 생성' },
      { value: 'later' as ErpLinkMode, label: '나중에 연결' },
    ] as const).map(opt => (
      <Button
        key={opt.value}
        type="button"
        variant={erpLinkMode === opt.value ? 'default' : 'outline'}
        size="sm"
        className={erpLinkMode === opt.value ? 'bg-brand-600 hover:bg-brand-700' : ''}
        onClick={() => {
          setErpLinkMode(opt.value)
          setSelectedErpClient(null)
          if (opt.value === 'select') loadErpClients()
        }}
      >
        {opt.label}
      </Button>
    ))}
  </div>

  {/* 거래처 드롭다운 목록 */}
  {erpLinkMode === 'select' && (
    <div className="space-y-2 border border-border rounded-lg p-3">
      {selectedErpClient ? (
        <div className="flex items-center gap-2 bg-brand-600/10 text-brand-600 rounded-md px-3 py-2 text-sm">
          <Link2 size={14} />
          <span className="font-medium">{erpDisplayName(selectedErpClient)}</span>
          <button type="button" onClick={() => setSelectedErpClient(null)} className="ml-auto hover:text-red-400">
            <X size={14} />
          </button>
        </div>
      ) : erpClientsLoading ? (
        <p className="text-xs text-muted-foreground text-center py-3">거래처 목록 불러오는 중...</p>
      ) : erpClients.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">등록된 거래처가 없습니다.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{erpClients.length}개 거래처</p>
          <div className="border border-border rounded-md max-h-48 overflow-y-auto">
            {erpClients
              .filter(item => {
                // 이미 Samantha에 연결된 거래처는 숨김
                const alreadyLinked = clinics.some((c: any) => c.erp_client_id === item.id)
                return !alreadyLinked
              })
              .map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedErpClient(item)
                  const displayName = erpDisplayName(item)
                  // Samantha에서는 form.name에 자동 채움
                  setForm(f => ({
                    ...f,
                    name: displayName,
                  }))
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-sm text-left border-b border-border last:border-b-0"
              >
                <span>
                  {erpDisplayName(item)}
                  {item.business_number && (
                    <span className="text-xs text-muted-foreground ml-2">{item.business_number}</span>
                  )}
                </span>
              </button>
            ))}
            {erpClients.filter(item => clinics.some((c: any) => c.erp_client_id === item.id)).length > 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
                이미 연결된 거래처 {erpClients.filter(item => clinics.some((c: any) => c.erp_client_id === item.id)).length}개는 숨김 처리됨
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )}

  {/* 새로 생성 */}
  {erpLinkMode === 'create' && (
    <div className="space-y-2 border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">클리닉 저장 시 glitzy-web에 거래처가 동시에 생성됩니다.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">사업자번호</Label>
          <Input
            type="text"
            value={erpCreateData.business_number}
            onChange={e => setErpCreateData(d => ({ ...d, business_number: e.target.value }))}
            placeholder="선택 입력"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">담당자명</Label>
          <Input
            type="text"
            value={erpCreateData.contact_name}
            onChange={e => setErpCreateData(d => ({ ...d, contact_name: e.target.value }))}
            placeholder="선택 입력"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">연락처</Label>
          <Input
            type="text"
            value={erpCreateData.contact_phone}
            onChange={e => setErpCreateData(d => ({ ...d, contact_phone: e.target.value }))}
            placeholder="선택 입력"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">이메일</Label>
          <Input
            type="email"
            value={erpCreateData.contact_email}
            onChange={e => setErpCreateData(d => ({ ...d, contact_email: e.target.value }))}
            placeholder="선택 입력"
          />
        </div>
      </div>
    </div>
  )}

  {/* 나중에 연결 */}
  {erpLinkMode === 'later' && (
    <p className="text-xs text-muted-foreground">거래처 없이 생성합니다. 나중에 설정에서 연결할 수 있습니다.</p>
  )}
</div>
```

### 7. handleSave 수정

클리닉 생성 API 호출 시 payload에 `erp_client_id` 또는 `create_erp_client` 추가:

```typescript
const handleSave = async () => {
  if (!form.name) {
    toast.error('클리닉명을 입력해주세요.')
    return
  }

  if (erpLinkMode === 'select' && !selectedErpClient) {
    toast.error('거래처를 선택해주세요.')
    return
  }

  setSaving(true)
  try {
    const payload: Record<string, unknown> = {
      name: form.name,
      // ... 기존 필드 유지
    }

    if (erpLinkMode === 'select' && selectedErpClient) {
      payload.erp_client_id = selectedErpClient.id
    } else if (erpLinkMode === 'create') {
      payload.create_erp_client = true
      payload.erp_client_data = {
        ...(erpCreateData.business_number ? { business_number: erpCreateData.business_number } : {}),
        ...(erpCreateData.contact_name ? { contact_name: erpCreateData.contact_name } : {}),
        ...(erpCreateData.contact_phone ? { contact_phone: erpCreateData.contact_phone } : {}),
        ...(erpCreateData.contact_email ? { contact_email: erpCreateData.contact_email } : {}),
      }
    }
    // erp_client_id가 없으면 (later) 연결 없이 생성

    const res = await fetch('/api/admin/clinics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    // ... 기존 성공/에러 처리
    resetErpForm()
  } catch (e: any) {
    toast.error(e.message || '등록 실패')
  } finally {
    setSaving(false)
  }
}
```

### 8. 클리닉 생성 API 수정

**`app/api/admin/clinics/route.ts`** POST 핸들러에 추가:

```typescript
// erp_client_id 직접 연결
if (body.erp_client_id) {
  insertData.erp_client_id = body.erp_client_id
}

// glitzy-web 거래처 동시 생성
if (body.create_erp_client) {
  try {
    const erpResult = await createErpClient({
      name: body.name,
      ...(body.erp_client_data || {}),
    })
    insertData.erp_client_id = erpResult.id
  } catch (err) {
    return apiError('glitzy-web 거래처 생성에 실패했습니다.', 502)
  }
}
```

## ERP 문서 조회 시 erp_client_id 사용

기존 `clinicId`를 직접 `clinic_id`로 보내던 방식을 `erp_client_id` 기반으로 변경:

```typescript
// 기존 (app/api/erp-documents/route.ts 등)
const result = await fetchQuotes(clinicId, ...)

// 변경
const { data: clinic } = await supabase
  .from('clinics')
  .select('erp_client_id')
  .eq('id', clinicId)
  .single()

if (!clinic?.erp_client_id) {
  return apiError('glitzy-web 거래처가 연결되지 않았습니다', 400)
}

const result = await fetchQuotes(clinic.erp_client_id, ...)
```

## 필요한 import

```typescript
import { useRef, useCallback } from 'react'
import { Link2, X } from 'lucide-react'
```

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| DB 마이그레이션 | `erp_client_id TEXT` 컬럼 추가 |
| `lib/services/erpClient.ts` | `fetchErpClients`, `createErpClient` 함수 추가 |
| `app/api/admin/erp-clients/route.ts` | 신규 — 거래처 검색 프록시 |
| `app/api/admin/clinics/route.ts` | POST에 erp_client_id / create_erp_client 처리 |
| `app/(dashboard)/admin/clinics/page.tsx` | 거래처 드롭다운 선택 UI |
| `app/api/erp-documents/*.ts` | erp_client_id 기반 조회로 변경 |

---

*작성일: 2026-04-17*
*Agatha 구현 기준 — Samantha에 동일 적용*
