/**
 * MediChecker 검증 이력 목록 API
 * - GET: 페이지네이션 지원 목록 조회
 */

import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('MediCheckerHistory')

export const GET = withClinicFilter(async (req, { clinicId, assignedClinicIds }) => {
  const supabase = serverSupabase()
  const url = new URL(req.url)

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20))
  const offset = (page - 1) * limit

  // 총 개수 조회
  let countQuery = supabase
    .from('mc_verification_logs')
    .select('id', { count: 'exact', head: true })

  const countFiltered = applyClinicFilter(countQuery, { clinicId, assignedClinicIds })
  if (countFiltered === null) return apiSuccess({ data: [], total: 0, page, limit })
  countQuery = countFiltered

  const { count, error: countError } = await countQuery

  if (countError) {
    logger.error('검증 이력 카운트 조회 실패', countError, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  // 데이터 조회
  let query = supabase
    .from('mc_verification_logs')
    .select('id, clinic_id, user_id, ad_type, risk_score, violation_count, summary, processing_time_ms, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess({ data: [], total: 0, page, limit })
  query = filtered

  const { data, error } = await query

  if (error) {
    logger.error('검증 이력 조회 실패', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  return apiSuccess({ data: data || [], total: count || 0, page, limit })
})
