import { withClientFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuotes, fetchInvoices } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPDocuments')

export const GET = withClientFilter(async (req, { user, clientId }) => {
  if (user.role === 'client_staff') return apiError('Forbidden', 403)
  if (!clientId) return apiError('클라이언트를 선택해주세요.', 400)

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'quotes'
  const status = url.searchParams.get('status') || undefined
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  try {
    if (type === 'invoices') {
      const result = await fetchInvoices(clientId, { status, page, limit })
      return apiSuccess(result)
    }
    const result = await fetchQuotes(clientId, { status, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 조회 실패', err, { clientId, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
