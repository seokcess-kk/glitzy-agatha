import { withClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuoteDetail, fetchInvoiceDetail } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'
import { serverSupabase } from '@/lib/supabase'
import { isDemoViewer, getDemoQuoteDetail, getDemoInvoices } from '@/lib/demo-data'

const logger = createLogger('ERPDocumentDetail')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GET = withClientFilter(async (req, { user, clientId }) => {
  if (user.role === 'client_staff') return apiError('Forbidden', 403)

  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()!
  const type = url.searchParams.get('type') || 'quotes'

  // 데모 뷰어: fixture 상세 데이터 반환
  if (isDemoViewer(user.role)) {
    if (type === 'invoices') {
      const inv = getDemoInvoices().data.find(i => i.id === id) || getDemoInvoices().data[0]
      return apiSuccess({ success: true, data: inv })
    }
    return apiSuccess(getDemoQuoteDetail(id))
  }

  if (!clientId) return apiError('클라이언트를 선택해주세요.', 400)

  // clients 테이블에서 erp_client_id 조회
  const supabase = serverSupabase()
  const { data: client } = await supabase
    .from('clients').select('erp_client_id').eq('id', clientId).single()
  if (!client?.erp_client_id) return apiError('glitzy-web 거래처가 연결되지 않았습니다', 400)

  if (!UUID_REGEX.test(id)) {
    return apiError('유효한 문서 ID가 필요합니다.', 400)
  }

  try {
    if (type === 'invoices') {
      const result = await fetchInvoiceDetail(client.erp_client_id, id)
      return apiSuccess(result)
    }
    const result = await fetchQuoteDetail(client.erp_client_id, id)
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 상세 조회 실패', err, { clientId, id, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
