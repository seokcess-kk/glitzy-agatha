import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess, blockDemoWrite } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { isDemoViewer, DEMO_CLIENTS } from '@/lib/demo-data'
import { createErpClient } from '@/lib/services/erpClient'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminClients')

export const GET = withSuperAdmin(async (_req, { user }) => {
  // 데모 뷰어: fixture 클라이언트 반환
  if (isDemoViewer(user.role)) return apiSuccess(DEMO_CLIENTS)

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request) => {
  const body = await req.json()
  const { name, slug, erp_client_id, create_erp_client, erp_client_data } = body

  if (!name || !slug) {
    return apiError('클라이언트명과 슬러그를 입력해주세요.', 400)
  }

  // 슬러그 형식 검증
  const slugPattern = /^[a-z0-9-]{2,50}$/
  if (!slugPattern.test(slug)) {
    return apiError('슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다. (2-50자)', 400)
  }

  let finalErpClientId: string | null = erp_client_id != null ? String(erp_client_id) : null

  // glitzy-web에 거래처 생성 요청
  if (create_erp_client && !finalErpClientId) {
    try {
      const erpResult = await createErpClient({
        name,
        business_number: erp_client_data?.business_number,
        contact_name: erp_client_data?.contact_name,
        contact_phone: erp_client_data?.contact_phone,
        contact_email: erp_client_data?.contact_email,
      })
      finalErpClientId = erpResult.id
      logger.info('glitzy-web 거래처 생성 성공', { erp_client_id: erpResult.id, name: erpResult.name })
    } catch (err) {
      logger.error('glitzy-web 거래처 생성 실패', err as Error)
      return apiError('glitzy-web 거래처 생성에 실패했습니다. 나중에 거래처를 연결해주세요.', 502)
    }
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: sanitizeString(name, 100),
      slug: slug.toLowerCase(),
      ...(finalErpClientId != null ? { erp_client_id: finalErpClientId } : {}),
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
