import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { fetchErpClients } from '@/lib/services/erpClient'
import { sanitizeString } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPSync')

/** ERP 거래처 → Agatha clients.name 표시값 */
function buildDisplayName(name: string, branchName?: string | null): string {
  const raw = branchName ? `${name} (${branchName})` : name
  return sanitizeString(raw, 100)
}

/**
 * POST /api/admin/erp-clients/sync
 * 이미 erp_client_id로 매핑된 Agatha clients의 이름만 ERP 기준으로 갱신.
 * - 갱신: 매핑됐는데 ERP 이름이 달라진 거래처 → name update
 * - 스킵: 매핑됐고 이름 동일 → no-op
 * - 미매핑: 카운트만 보고. 자동 생성하지 않음 (신규 매핑은 webhook 또는 사용자 등록 흐름으로)
 * - superadmin 전용
 */
export const POST = withSuperAdmin(async () => {
  const supabase = serverSupabase()

  // 1. Agatha의 매핑된 거래처 전체 조회 (id, name, erp_client_id)
  const { data: existingClients, error: selErr } = await supabase
    .from('clients')
    .select('id, name, erp_client_id')
    .not('erp_client_id', 'is', null)
  if (selErr) {
    logger.error('clients 조회 실패', { error: selErr })
    return apiError('clients 조회에 실패했습니다', 500)
  }

  if (!existingClients || existingClients.length === 0) {
    return apiSuccess({
      matched: 0,
      updated: 0,
      skipped: 0,
      unmapped: 0,
      message: '매핑된 거래처가 없습니다',
    })
  }

  const existingMap = new Map<number, { erpId: string; name: string }>()
  const mappedErpIds = new Set<string>()
  for (const c of existingClients) {
    if (c.erp_client_id) {
      existingMap.set(c.id, { erpId: c.erp_client_id, name: c.name })
      mappedErpIds.add(c.erp_client_id)
    }
  }

  // 2. glitzy-web 거래처 전체 조회 (페이지네이션 순회)
  const allErpClients: Array<{ id: string; name: string; branch_name?: string | null }> = []
  let page = 1
  const limit = 100

  while (true) {
    try {
      const result = await fetchErpClients({ page, limit })
      allErpClients.push(...result.data)
      if (page >= result.pagination.totalPages) break
      page++
    } catch (err) {
      logger.error('glitzy-web 거래처 조회 실패', { page, error: err })
      return apiError('glitzy-web 거래처 목록을 가져올 수 없습니다', 502)
    }
  }

  // erpId → ERP 거래처 인덱스
  const erpMap = new Map<string, { name: string; branch_name?: string | null }>()
  for (const e of allErpClients) {
    erpMap.set(e.id, { name: e.name, branch_name: e.branch_name })
  }

  // 3. 매핑된 거래처만 순회 — 이름 갱신 / 스킵
  let updated = 0
  let skipped = 0
  let mappingMissing = 0 // 매핑된 erp_client_id 인데 ERP에서 사라진 경우
  const errors: Array<{ clientId: number; erpId: string; error: string }> = []

  for (const [clientId, { erpId, name: currentName }] of existingMap) {
    const erp = erpMap.get(erpId)
    if (!erp) {
      mappingMissing++
      logger.warn('매핑된 ERP 거래처가 ERP 목록에 없음', { clientId, erpId })
      continue
    }

    const displayName = buildDisplayName(erp.name, erp.branch_name)
    if (currentName === displayName) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('clients')
      .update({ name: displayName })
      .eq('id', clientId)
    if (error) {
      logger.error('클라이언트 이름 갱신 실패', { clientId, erpId, error })
      errors.push({ clientId, erpId, error: error.message })
    } else {
      updated++
      logger.info('이름 동기화', { clientId, erpId, before: currentName, after: displayName })
    }
  }

  const unmapped = allErpClients.filter((e) => !mappedErpIds.has(e.id)).length

  logger.info('이름 동기화 완료', {
    matched: existingMap.size,
    updated,
    skipped,
    mappingMissing,
    unmapped,
    errors: errors.length,
  })

  return apiSuccess({
    matched: existingMap.size,
    updated,
    skipped,
    mappingMissing,
    unmapped,
    errors: errors.length > 0 ? errors : undefined,
    message: `${updated}개 이름 갱신, ${skipped}개 변경 없음 (미매핑 ERP 거래처 ${unmapped}개는 처리하지 않음)`,
  })
})
