/**
 * 일회성 수동 동기화 스크립트
 * - POST /api/admin/erp-clients/sync 의 로직을 로컬에서 직접 실행
 * - 사용: node --env-file=.env.local --import tsx scripts/sync-erp-clients-once.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ERP_API_URL = process.env.ERP_API_URL
const ERP_SERVICE_KEY = process.env.ERP_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE 환경변수 누락')
  process.exit(1)
}
if (!ERP_API_URL || !ERP_SERVICE_KEY) {
  console.error('ERP 환경변수 누락')
  process.exit(1)
}

function sanitizeString(input: string, maxLen: number): string {
  const cleaned = input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .trim()
  return cleaned.slice(0, maxLen)
}

function buildDisplayName(name: string, branchName?: string | null): string {
  const raw = branchName ? `${name} (${branchName})` : name
  return sanitizeString(raw, 100)
}

interface ErpClientItem {
  id: string
  name: string
  branch_name?: string | null
  business_number?: string
}

interface ErpListResponse {
  success: boolean
  data: ErpClientItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  error?: string
}

async function fetchErpPage(page: number, limit: number): Promise<ErpListResponse> {
  const res = await fetch(`${ERP_API_URL}/clients?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${ERP_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`ERP API HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const body = (await res.json()) as ErpListResponse
  if (body.success === false) throw new Error(body.error || 'ERP API 응답 실패')
  return body
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log('[1/3] glitzy-web 거래처 목록 조회 시작')
  const all: ErpClientItem[] = []
  let page = 1
  const limit = 100
  while (true) {
    const result = await fetchErpPage(page, limit)
    all.push(...result.data)
    console.log(`  page=${page}/${result.pagination.totalPages} (+${result.data.length})`)
    if (page >= result.pagination.totalPages) break
    page++
  }
  console.log(`총 ${all.length}개 거래처 조회 완료`)

  if (all.length === 0) {
    console.log('동기화할 거래처가 없습니다.')
    return
  }

  console.log('[2/3] Agatha clients 매핑 조회')
  const { data: existingClients, error: selErr } = await supabase
    .from('clients')
    .select('id, name, erp_client_id')
    .not('erp_client_id', 'is', null)
  if (selErr) throw new Error(`clients 조회 실패: ${selErr.message}`)

  const existingMap = new Map<string, { id: number; name: string }>()
  for (const c of existingClients || []) {
    if (c.erp_client_id) existingMap.set(c.erp_client_id, { id: c.id, name: c.name })
  }
  console.log(`매핑된 클라이언트 ${existingMap.size}개`)

  console.log('[3/3] 동기화 진행')
  let created = 0
  let updated = 0
  let skipped = 0
  const errors: Array<{ id: string; name: string; error: string }> = []
  const renamed: Array<{ before: string; after: string }> = []

  for (const erp of all) {
    const displayName = buildDisplayName(erp.name, erp.branch_name)
    const existing = existingMap.get(erp.id)

    if (!existing) {
      const slug = `erp-${erp.id.slice(0, 8)}`
      const { error } = await supabase.from('clients').insert({
        name: displayName,
        erp_client_id: erp.id,
        slug,
        is_active: true,
      })
      if (error) {
        errors.push({ id: erp.id, name: erp.name, error: error.message })
      } else {
        created++
        console.log(`  + 생성: ${displayName}`)
      }
      continue
    }

    if (existing.name === displayName) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('clients')
      .update({ name: displayName })
      .eq('id', existing.id)
    if (error) {
      errors.push({ id: erp.id, name: erp.name, error: error.message })
    } else {
      updated++
      renamed.push({ before: existing.name, after: displayName })
      console.log(`  ~ 이름 갱신: "${existing.name}" → "${displayName}"`)
    }
  }

  console.log('\n=== 결과 ===')
  console.log(`총 ERP 거래처: ${all.length}`)
  console.log(`신규 생성:     ${created}`)
  console.log(`이름 갱신:     ${updated}`)
  console.log(`변경 없음:     ${skipped}`)
  console.log(`오류:          ${errors.length}`)
  if (errors.length > 0) {
    console.log('\n오류 목록:')
    for (const e of errors) console.log(`  - [${e.id}] ${e.name}: ${e.error}`)
  }
}

main().catch((err) => {
  console.error('동기화 실패:', err)
  process.exit(1)
})
