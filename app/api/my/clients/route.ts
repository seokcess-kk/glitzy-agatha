import { serverSupabase } from '@/lib/supabase'
import { withAuth, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withAuth(async (req, { user }) => {
  const supabase = serverSupabase()

  if (user.role === 'superadmin') {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name')
    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  }

  if (user.role === 'agency_staff') {
    const { data, error } = await supabase
      .from('user_client_assignments')
      .select('client:clients(id, name, slug)')
      .eq('user_id', parseInt(user.id, 10))
    if (error) return apiError(error.message, 500)
    const clients = (data || []).map((d: any) => d.client).filter(Boolean)
    return apiSuccess(clients)
  }

  // client_admin / client_staff: 자기 클라이언트만
  if (user.client_id) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, slug')
      .eq('id', user.client_id)
      .single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data ? [data] : [])
  }

  return apiSuccess([])
})
