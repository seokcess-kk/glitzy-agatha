import { serverSupabase } from '@/lib/supabase'
import { withClientFilter, ClientContext, applyClientFilter, apiError, apiSuccess } from '@/lib/api-middleware'

/**
 * 랜딩 페이지 목록 (인증된 사용자용)
 * - client_admin은 자기 클라이언트 랜딩 페이지만 조회
 * - superadmin은 전체 또는 client_id 필터
 */
export const GET = withClientFilter(async (req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('landing_pages')
    .select('id, name, client_id')
    .eq('is_active', true)
    .order('name')

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (filtered === null) return apiSuccess([])
  query = filtered

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  return apiSuccess(data || [])
})
