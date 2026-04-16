import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminClientBudgetHistory')

/**
 * GET: 예산 변경 이력 목록 (시간순)
 */
export const GET = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // /api/admin/clients/[id]/budget/history → segments에서 id 추출
  const idIndex = segments.indexOf('clients') + 1
  const id = parseId(segments[idIndex])
  if (!id) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  try {
    // 클라이언트 존재 여부 확인
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', id)
      .single()

    if (clientError || !client) {
      return apiError('클라이언트를 찾을 수 없습니다.', 404)
    }

    // 변경 이력 조회 (시간순 — 오래된 것부터)
    const { data: history, error: historyError } = await supabase
      .from('budget_history')
      .select('id, previous_budget, new_budget, memo, created_at, changed_by')
      .eq('client_id', id)
      .order('created_at', { ascending: true })

    if (historyError) {
      logger.error('예산 이력 조회 오류', historyError, { clientId: id })
      return apiError('이력 조회에 실패했습니다.', 500)
    }

    return apiSuccess({
      clientId: client.id,
      clientName: client.name,
      history: history || [],
    })
  } catch (error) {
    logger.error('예산 이력 조회 실패', error, { clientId: id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
