import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

/**
 * 랜딩 페이지 목록 (인증된 사용자용)
 * - clinic_admin은 자기 병원 랜딩 페이지만 조회
 * - superadmin은 전체 또는 clinic_id 필터
 */
export const GET = withClinicFilter(async (req: Request, { clinicId, assignedClinicIds }: ClinicContext) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('landing_pages')
    .select('id, name, clinic_id')
    .eq('is_active', true)
    .order('name')

  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  return apiSuccess(data || [])
})
