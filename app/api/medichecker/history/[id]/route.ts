/**
 * MediChecker 검증 이력 상세 API
 * - GET: 단건 조회 (clinic_id 필터 포함)
 */

import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('MediCheckerHistoryDetail')

export const GET = withClinicFilter(async (req, { clinicId, assignedClinicIds }) => {
  const url = new URL(req.url)
  const idSegment = url.pathname.split('/').pop()
  const id = parseId(idSegment)
  if (!id) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  let query = supabase
    .from('mc_verification_logs')
    .select('*')
    .eq('id', id)

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiError('접근 권한이 없습니다.', 403)
  query = filtered

  const { data, error } = await query.single()

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return apiError('검증 이력을 찾을 수 없습니다.', 404)
    }
    logger.error('검증 이력 상세 조회 실패', error, { id, clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  return apiSuccess(data)
})
