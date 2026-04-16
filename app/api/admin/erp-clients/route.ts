import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { fetchErpClients } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminErpClients')

export const GET = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') || undefined
  const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined

  try {
    const result = await fetchErpClients({ search, page, limit })
    return apiSuccess(result)
  } catch (err) {
    logger.error('glitzy-web 거래처 조회 실패', err as Error)
    return apiError('glitzy-web 거래처 조회에 실패했습니다. ERP 연동 설정을 확인해주세요.', 502)
  }
})
