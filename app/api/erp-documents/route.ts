import { withClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuotes, fetchInvoices } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'
import { serverSupabase } from '@/lib/supabase'
import { isDemoViewer, getDemoQuotes, getDemoInvoices } from '@/lib/demo-data'

const logger = createLogger('ERPDocuments')

export const GET = withClientFilter(async (req, { user, clientId }) => {
  if (user.role === 'client_staff') return apiError('Forbidden', 403)

  // 데모 뷰어: fixture 데이터 반환
  if (isDemoViewer(user.role)) {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'quotes'
    return apiSuccess(type === 'invoices' ? getDemoInvoices() : getDemoQuotes())
  }

  if (!clientId) return apiError('클라이언트를 선택해주세요.', 400)

  // clients 테이블에서 erp_client_id 조회
  const supabase = serverSupabase()
  const { data: client } = await supabase
    .from('clients').select('erp_client_id').eq('id', clientId).single()
  if (!client?.erp_client_id) return apiError('glitzy-web 거래처가 연결되지 않았습니다', 400)

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'quotes'
  const status = url.searchParams.get('status') || undefined
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  try {
    if (type === 'invoices') {
      const result = await fetchInvoices(client.erp_client_id, { status, page, limit })
      return apiSuccess(result)
    }
    const result = await fetchQuotes(client.erp_client_id, { status, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 조회 실패', err, { clientId, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
