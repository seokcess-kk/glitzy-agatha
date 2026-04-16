import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { fetchErpClients } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPSync')

/**
 * POST /api/admin/erp-clients/sync
 * glitzy-web 거래처 전체를 Agatha clients에 일괄 동기화
 * - 이미 erp_client_id가 매핑된 거래처는 건너뜀
 * - 신규 거래처만 자동 생성
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
    return apiSuccess({ created: 0, skipped: 0, total: 0, message: 'glitzy-web에 거래처가 없습니다' })
  }

  // 2. Agatha에 이미 매핑된 erp_client_id 조회
  const { data: existingClients } = await supabase
    .from('clients')
    .select('erp_client_id')
    .not('erp_client_id', 'is', null)

  const existingErpIds = new Set(
    (existingClients || []).map(c => c.erp_client_id)
  )

  // 3. 신규만 필터링해서 일괄 생성
  const newClients = allErpClients.filter(erp => !existingErpIds.has(erp.id))

  let created = 0
  const errors: Array<{ id: string; name: string; error: string }> = []

  for (const erp of newClients) {
    const slug = `erp-${erp.id.slice(0, 8)}`
    const displayName = erp.branch_name ? `${erp.name} (${erp.branch_name})` : erp.name
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
  }

  const skipped = allErpClients.length - newClients.length

  logger.info('일괄 동기화 완료', {
    total: allErpClients.length,
    created,
    skipped,
    errors: errors.length,
  })

  return apiSuccess({
    total: allErpClients.length,
    created,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    message: `${created}개 생성, ${skipped}개 이미 연결됨`,
  })
})
