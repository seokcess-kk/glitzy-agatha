/**
 * 일회성 수동 동기화 스크립트 — '이름 갱신만' 모드
 * - POST /api/admin/erp-clients/sync 의 로직을 로컬에서 직접 실행
 * - 이미 erp_client_id로 매핑된 clients의 name만 ERP 기준으로 갱신
 * - 신규 거래처는 자동 생성하지 않음 (webhook/등록 흐름 전용)
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

  console.log('[1/3] Agatha 매핑 clients 조회')
  const { data: existing, error: selErr } = await supabase
    .from('clients')
    .select('id, name, erp_client_id')
    .not('erp_client_id', 'is', null)
  if (selErr) throw new Error(selErr.message)
  console.log(`  매핑된 클라이언트 ${existing?.length ?? 0}개`)
  if (!existing || existing.length === 0) {
    console.log('갱신 대상 없음')
    return
  }

  console.log('[2/3] glitzy-web 거래처 목록 조회')
  const all: ErpClientItem[] = []
  let page = 1
  const limit = 100
  while (true) {
    const result = await fetchErpPage(page, limit)
    all.push(...result.data)
    if (page >= result.pagination.totalPages) break
    page++
  }
  console.log(`  총 ${all.length}개 ERP 거래처 조회`)

  const erpMap = new Map<string, { name: string; branch_name?: string | null }>()
  for (const e of all) erpMap.set(e.id, { name: e.name, branch_name: e.branch_name })

  console.log('[3/3] 이름 갱신 진행')
  let updated = 0
  let skipped = 0
  let mappingMissing = 0
  const errors: Array<{ clientId: number; erpId: string; error: string }> = []
  const renamed: Array<{ before: string; after: string }> = []

  for (const c of existing) {
    if (!c.erp_client_id) continue
    const erp = erpMap.get(c.erp_client_id)
    if (!erp) {
      mappingMissing++
      console.log(`  ? 매핑된 ERP 거래처가 ERP에 없음: client id=${c.id} erp=${c.erp_client_id}`)
      continue
    }
    const displayName = buildDisplayName(erp.name, erp.branch_name)
    if (c.name === displayName) {
      skipped++
      continue
    }
    const { error } = await supabase
      .from('clients')
      .update({ name: displayName })
      .eq('id', c.id)
    if (error) {
      errors.push({ clientId: c.id, erpId: c.erp_client_id, error: error.message })
    } else {
      updated++
      renamed.push({ before: c.name, after: displayName })
      console.log(`  ~ 이름 갱신: "${c.name}" → "${displayName}"`)
    }
  }

  const mappedErpIds = new Set(existing.map((c) => c.erp_client_id).filter(Boolean) as string[])
  const unmapped = all.filter((e) => !mappedErpIds.has(e.id)).length

  console.log('\n=== 결과 ===')
  console.log(`매핑된 클라이언트:        ${existing.length}`)
  console.log(`이름 갱신:                ${updated}`)
  console.log(`변경 없음:                ${skipped}`)
  console.log(`ERP에서 사라진 매핑:      ${mappingMissing}`)
  console.log(`미매핑 ERP 거래처(무시):  ${unmapped}`)
  console.log(`오류:                     ${errors.length}`)
  if (errors.length > 0) {
    console.log('\n오류 목록:')
    for (const e of errors) console.log(`  - client=${e.clientId} erp=${e.erpId}: ${e.error}`)
  }
}

main().catch((err) => {
  console.error('동기화 실패:', err)
  process.exit(1)
})
