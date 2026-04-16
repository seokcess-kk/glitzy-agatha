import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'

export const GET = withSuperAdmin(async (_req, { user }) => {
  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const POST = withSuperAdmin(async (req: Request) => {
  const { name, slug } = await req.json()

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
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
