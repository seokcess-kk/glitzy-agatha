import { serverSupabase } from '@/lib/supabase'
import { withAuth, apiSuccess, apiError } from '@/lib/api-middleware'

export const GET = withAuth(async (req, { user }) => {
  // agency_staff만 메뉴 제한이 있음
  if (user.role !== 'agency_staff') {
    return apiSuccess({ all: true, permissions: [] })
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('user_menu_permissions')
    .select('menu_key')
    .eq('user_id', parseInt(user.id, 10))

  if (error) return apiError(error.message, 500)
  const permissions = (data || []).map((d: any) => d.menu_key)
  return apiSuccess({ all: false, permissions })
})
