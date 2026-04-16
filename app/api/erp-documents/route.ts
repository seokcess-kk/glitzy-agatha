import { withClinicFilter, apiSuccess, apiError } from '@/lib/api-middleware'
import { fetchQuotes, fetchInvoices } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ERPDocuments')

export const GET = withClinicFilter(async (req, { user, clinicId }) => {
  if (user.role === 'clinic_staff') return apiError('Forbidden', 403)
  if (!clinicId) return apiError('병원을 선택해주세요.', 400)

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'quotes'
  const status = url.searchParams.get('status') || undefined
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  try {
    if (type === 'invoices') {
      const result = await fetchInvoices(clinicId, { status, page, limit })
      return apiSuccess(result)
    }
    const result = await fetchQuotes(clinicId, { status, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('ERP 문서 조회 실패', err, { clinicId, type })
    return apiError('ERP 문서 조회에 실패했습니다.', 500)
  }
})
