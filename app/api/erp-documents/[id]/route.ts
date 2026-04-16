import { withClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuoteDetail, fetchInvoiceDetail } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPDocumentDetail')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GET = withClinicFilter(async (req, { user, clinicId }) => {
  if (user.role === 'clinic_staff') return apiError('Forbidden', 403)
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()!
  const type = url.searchParams.get('type') || 'quotes'

  if (!UUID_REGEX.test(id)) {
    return apiError('유효한 문서 ID가 필요합니다.', 400)
  }

  try {
    if (type === 'invoices') {
      const result = await fetchInvoiceDetail(clinicId, id)
      return apiSuccess(result)
    }
    const result = await fetchQuoteDetail(clinicId, id)
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 상세 조회 실패', err, { clinicId, id, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
