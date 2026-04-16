import { serverSupabase } from '@/lib/supabase'
import { withAuth, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'
import { isDemoViewer } from '@/lib/demo-data'

const logger = createLogger('MenuVisibility')

/** 인증된 사용자가 숨김 메뉴 목록을 조회 */
export const GET = withAuth(async (_req, { user }) => {
  if (isDemoViewer(user.role)) return apiSuccess({ hiddenMenus: [] })
  try {
    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'hidden_menus')
      .single()

    if (error) {
      // 테이블/행 없으면 빈 배열 반환 (숨김 메뉴 없음)
      return apiSuccess({ hiddenMenus: [] })
    }

    const hiddenMenus = Array.isArray(data.value) ? data.value : []
    return apiSuccess({ hiddenMenus })
  } catch (err) {
    logger.error('숨김 메뉴 조회 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
