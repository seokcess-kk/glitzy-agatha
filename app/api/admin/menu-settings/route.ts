import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminMenuSettings')

// 전체 메뉴 키 화이트리스트
const VALID_MENU_KEYS = [
  'dashboard', 'campaigns', 'leads', 'patients', 'chatbot',
  'ads', 'content', 'monitor', 'press', 'monitoring',
  'medichecker', 'erp-documents',
]

/** 숨김 메뉴 목록 조회 */
export const GET = withSuperAdmin(async () => {
  try {
    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'hidden_menus')
      .single()

    if (error) return apiSuccess({ hiddenMenus: [] })

    const hiddenMenus = Array.isArray(data.value) ? data.value : []
    return apiSuccess({ hiddenMenus })
  } catch (err) {
    logger.error('숨김 메뉴 조회 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

/** 숨김 메뉴 목록 업데이트 */
export const PUT = withSuperAdmin(async (req: Request) => {
  try {
    const { hiddenMenus } = await req.json()

    if (!Array.isArray(hiddenMenus)) {
      return apiError('hiddenMenus는 배열이어야 합니다.', 400)
    }

    // 유효한 메뉴 키만 필터
    const validated = hiddenMenus.filter(
      (k: unknown): k is string => typeof k === 'string' && VALID_MENU_KEYS.includes(k)
    )

    const supabase = serverSupabase()
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'hidden_menus',
        value: validated,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      logger.error('숨김 메뉴 저장 실패', error)
      return apiError(error.message, 500)
    }

    return apiSuccess({ hiddenMenus: validated })
  } catch (err) {
    logger.error('숨김 메뉴 업데이트 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
