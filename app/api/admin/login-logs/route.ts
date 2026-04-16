import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'

export const GET = withSuperAdmin(async (req) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
  const username = url.searchParams.get('username') || ''
  const successOnly = url.searchParams.get('success')

  const supabase = serverSupabase()
  let query = supabase
    .from('login_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (username) {
    query = query.ilike('username', `%${username}%`)
  }

  if (successOnly === 'true') {
    query = query.eq('success', true)
  } else if (successOnly === 'false') {
    query = query.eq('success', false)
  }

  const { data, count, error } = await query

  if (error) {
    return apiError('로그인 로그 조회에 실패했습니다.', 500)
  }

  return apiSuccess({
    logs: data || [],
    total: count || 0,
    page,
    limit,
  })
})
