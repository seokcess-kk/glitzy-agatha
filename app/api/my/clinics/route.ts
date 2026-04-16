import { serverSupabase } from '@/lib/supabase'
import { withAuth, apiError, apiSuccess } from '@/lib/api-middleware'

export const GET = withAuth(async (req, { user }) => {
  const supabase = serverSupabase()

  if (user.role === 'superadmin') {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name')
    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  }

  if (user.role === 'agency_staff') {
    const { data, error } = await supabase
      .from('user_clinic_assignments')
      .select('clinic:clinics(id, name, slug)')
      .eq('user_id', parseInt(user.id, 10))
    if (error) return apiError(error.message, 500)
    const clinics = (data || []).map((d: any) => d.clinic).filter(Boolean)
    return apiSuccess(clinics)
  }

  // clinic_admin / clinic_staff: 자기 병원만
  if (user.clinic_id) {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, slug')
      .eq('id', user.clinic_id)
      .single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data ? [data] : [])
  }

  return apiSuccess([])
})
