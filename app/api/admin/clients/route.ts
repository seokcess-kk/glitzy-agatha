import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess, blockDemoWrite } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { isDemoViewer, DEMO_CLIENTS } from '@/lib/demo-data'

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
  const { name, slug, erp_client_id } = await req.json()

  if (!name || !slug) {
    return apiError('클라이언트명과 슬러그를 입력해주세요.', 400)
  }

  // 슬러그 형식 검증
  const slugPattern = /^[a-z0-9-]{2,50}$/
  if (!slugPattern.test(slug)) {
    return apiError('슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다. (2-50자)', 400)
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: sanitizeString(name, 100),
      slug: slug.toLowerCase(),
      ...(erp_client_id != null ? { erp_client_id: Number(erp_client_id) } : {}),
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
