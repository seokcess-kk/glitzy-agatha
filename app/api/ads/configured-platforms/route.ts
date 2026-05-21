/**
 * 현재 클라이언트에 연동된 활성 광고 매체 목록 조회.
 *
 * - "수동 인입 보정", 채널별 액션 등 매체 연동 여부에 따라 노출 제어가 필요한 UI 가드용.
 * - client_api_configs.is_active=true 행을 distinct platform 으로 반환.
 * - superadmin/agency_staff 가 client_id 미지정이면 빈 배열 또는 배정 클라이언트들의 합집합.
 */

import { withClientFilter, ClientContext, applyClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ConfiguredPlatforms')

export const GET = withClientFilter(async (_req: Request, { clientId, assignedClientIds }: ClientContext) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('client_api_configs')
    .select('platform')
    .eq('is_active', true)

  const filtered = applyClientFilter(query, { clientId, assignedClientIds })
  if (!filtered) return apiSuccess({ platforms: [] })

  const { data, error } = await filtered
  if (error) {
    logger.error('client_api_configs 조회 실패', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  const platforms = Array.from(new Set((data || []).map((r: { platform: string }) => r.platform)))
  return apiSuccess({ platforms })
})
