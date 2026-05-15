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
 * glitzy-web 거래처 전체를 Agatha clients에 일괄 동기화 (upsert 모드).
 * - 신규: erp_client_id 미매핑 거래처 → 생성
 * - 갱신: 매핑됐는데 ERP 이름이 달라진 거래처 → name update
 * - 스킵: 매핑됐고 이름도 동일 → no-op
 * - superadmin 전용
 */
export const POST = withSuperAdmin(async () => {
  const supabase = serverSupabase()

  // 1. glitzy-web 거래처 전체 조회 (페이지네이션 순회)
  const allErpClients: Array<{ id: string; name: string; branch_name?: string | null; business_number?: string }> = []
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

  if (allErpClients.length === 0) {
    return apiSuccess({ created: 0, updated: 0, skipped: 0, total: 0, message: 'glitzy-web에 거래처가 없습니다' })
  }

  // 2. Agatha의 매핑된 거래처 전체 조회 (id, name 포함) — 이름 비교용
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name, erp_client_id')
    .not('erp_client_id', 'is', null)

  const existingMap = new Map<string, { id: number; name: string }>()
  for (const c of existingClients || []) {
    if (c.erp_client_id) existingMap.set(c.erp_client_id, { id: c.id, name: c.name })
  }

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: Array<{ id: string; name: string; error: string }> = []

  // 3. ERP 거래처 순회 — 신규 생성 / 이름 갱신 / 스킵 분기
  for (const erp of allErpClients) {
    const displayName = buildDisplayName(erp.name, erp.branch_name)
    const existing = existingMap.get(erp.id)

    if (!existing) {
      // 신규 생성
      const slug = `erp-${erp.id.slice(0, 8)}`
      const { error } = await supabase.from('clients').insert({
        name: displayName,
        erp_client_id: erp.id,
        slug,
        is_active: true,
      })
      if (error) {
        logger.error('클라이언트 생성 실패', { erpId: erp.id, name: erp.name, error })
        errors.push({ id: erp.id, name: erp.name, error: error.message })
      } else {
        created++
      }
      continue
    }

    if (existing.name === displayName) {
      skipped++
      continue
    }

    // 이름 변동 → update
    const { error } = await supabase
      .from('clients')
      .update({ name: displayName })
      .eq('id', existing.id)
    if (error) {
      logger.error('클라이언트 이름 갱신 실패', { erpId: erp.id, clientId: existing.id, error })
      errors.push({ id: erp.id, name: erp.name, error: error.message })
    } else {
      updated++
      logger.info('이름 동기화', { erpId: erp.id, before: existing.name, after: displayName })
    }
  }

  logger.info('일괄 동기화 완료', {
    total: allErpClients.length,
    created,
    updated,
    skipped,
    errors: errors.length,
  })

  return apiSuccess({
    total: allErpClients.length,
    created,
    updated,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    message: `${created}개 생성, ${updated}개 이름 갱신, ${skipped}개 변경 없음`,
  })
})
