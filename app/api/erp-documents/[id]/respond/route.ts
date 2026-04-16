import { withClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { respondToQuote } from '@/lib/services/erpClient'
import { sanitizeString } from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { createLogger } from '@/lib/logger'
import { serverSupabase } from '@/lib/supabase'

const logger = createLogger('ERPQuoteRespond')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_ACTIONS = ['approve', 'reject'] as const

export const PATCH = withClientFilter(async (req, { user, clientId }) => {
  if (user.role === 'client_staff') return apiError('Forbidden', 403)
  if (!clientId) return apiError('클라이언트를 선택해주세요.', 400)

  // clients 테이블에서 erp_client_id 조회
  const supabase = serverSupabase()
  const { data: client } = await supabase
    .from('clients').select('erp_client_id').eq('id', clientId).single()
  if (!client?.erp_client_id) return apiError('glitzy-web 거래처가 연결되지 않았습니다', 400)

  // URL에서 [id] 추출 — /api/erp-documents/{id}/respond
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const respondIdx = segments.lastIndexOf('respond')
  const id = respondIdx > 0 ? segments[respondIdx - 1] : ''

  if (!UUID_REGEX.test(id)) {
    return apiError('유효한 문서 ID가 필요합니다.', 400)
  }

  let body: { action?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('요청 본문이 올바르지 않습니다.', 400)
  }

  const action = body.action
  if (!action || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
    return apiError('action은 approve 또는 reject만 가능합니다.', 400)
  }

  const reason = body.reason ? sanitizeString(body.reason, 1000) : undefined

  try {
    const result = await respondToQuote(
      client.erp_client_id,
      id,
      action as 'approve' | 'reject',
      reason,
    )

    // 활동 로그 기록 (non-blocking)
    logActivity(supabase, {
      userId: user.id,
      clientId,
      action: action === 'approve' ? 'quote_approved' : 'quote_rejected',
      targetTable: 'erp_quotes',
      detail: { quoteId: id, reason },
    })

    return apiSuccess(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ERP 처리 실패'
    logger.error('견적서 응답 실패', err, { clientId, id, action })

    // glitzy-web HTTP 에러 상태 코드를 그대로 전달
    if (message.includes('HTTP 409')) return apiError('이미 처리된 견적서입니다.', 409)
    if (message.includes('HTTP 404')) return apiError('견적서를 찾을 수 없습니다.', 404)
    if (message.includes('HTTP 400')) return apiError('잘못된 요청입니다.', 400)
    return apiError('견적서 처리에 실패했습니다.', 500)
  }
})
