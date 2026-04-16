import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId, sanitizeString } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminClientBudget')

/**
 * GET: 현재 예산 + 변경 이력
 */
export const GET = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // /api/admin/clients/[id]/budget → segments에서 id 추출
  const idIndex = segments.indexOf('clients') + 1
  const id = parseId(segments[idIndex])
  if (!id) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  try {
    // 현재 예산 조회
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, monthly_budget')
      .eq('id', id)
      .single()

    if (clientError || !client) {
      return apiError('클라이언트를 찾을 수 없습니다.', 404)
    }

    // 최근 변경 이력 (최신 10건)
    const { data: history, error: historyError } = await supabase
      .from('budget_history')
      .select('id, previous_budget, new_budget, memo, created_at, changed_by')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (historyError) {
      logger.error('예산 이력 조회 오류', historyError, { clientId: id })
    }

    return apiSuccess({
      clientId: client.id,
      clientName: client.name,
      monthlyBudget: Number(client.monthly_budget) || 0,
      history: history || [],
    })
  } catch (error) {
    logger.error('예산 조회 실패', error, { clientId: id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

/**
 * PATCH: 예산 수정 (new_budget, memo)
 * → budget_history에 이력 기록
 * → clients.monthly_budget 업데이트
 */
export const PATCH = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const idIndex = segments.indexOf('clients') + 1
  const id = parseId(segments[idIndex])
  if (!id) return apiError('유효한 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  try {
    const body = await req.json()
    const newBudget = Number(body.new_budget)
    const memo = sanitizeString(body.memo || '', 500)

    if (isNaN(newBudget) || newBudget < 0) {
      return apiError('유효한 예산 금액이 필요합니다.', 400)
    }

    // 현재 예산 조회
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, monthly_budget')
      .eq('id', id)
      .single()

    if (clientError || !client) {
      return apiError('클라이언트를 찾을 수 없습니다.', 404)
    }

    const previousBudget = Number(client.monthly_budget) || 0

    // budget_history에 이력 기록
    const { error: historyError } = await supabase
      .from('budget_history')
      .insert({
        client_id: id,
        previous_budget: previousBudget,
        new_budget: newBudget,
        memo,
        changed_by: parseInt(user.id, 10),
      })

    if (historyError) {
      logger.error('예산 이력 기록 실패', historyError, { clientId: id })
      return apiError('예산 이력 기록에 실패했습니다.', 500)
    }

    // clients.monthly_budget 업데이트
    const { error: updateError } = await supabase
      .from('clients')
      .update({ monthly_budget: newBudget })
      .eq('id', id)

    if (updateError) {
      logger.error('예산 업데이트 실패', updateError, { clientId: id })
      return apiError('예산 업데이트에 실패했습니다.', 500)
    }

    return apiSuccess({
      clientId: id,
      previousBudget,
      newBudget,
      memo,
    })
  } catch (error) {
    logger.error('예산 수정 실패', error, { clientId: id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
