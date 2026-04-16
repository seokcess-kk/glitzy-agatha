import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'

export const GET = withSuperAdmin(async (req: Request) => {
  const userId = parseId(new URL(req.url).pathname.split('/users/')[1]?.split('/')[0])
  if (!userId) return apiError('유효한 사용자 ID가 필요합니다.', 400)

  const supabase = serverSupabase()

  const [assignRes, permRes] = await Promise.all([
    supabase.from('user_clinic_assignments').select('clinic_id').eq('user_id', userId),
    supabase.from('user_menu_permissions').select('menu_key').eq('user_id', userId),
  ])

  if (assignRes.error) return apiError(assignRes.error.message, 500)
  if (permRes.error) return apiError(permRes.error.message, 500)

  return apiSuccess({
    assigned_clinic_ids: (assignRes.data || []).map((d: any) => d.clinic_id),
    menu_permissions: (permRes.data || []).map((d: any) => d.menu_key),
  })
})

export const PUT = withSuperAdmin(async (req: Request) => {
  const userId = parseId(new URL(req.url).pathname.split('/users/')[1]?.split('/')[0])
  if (!userId) return apiError('유효한 사용자 ID가 필요합니다.', 400)

  const { assigned_clinic_ids, menu_permissions } = await req.json()
  const supabase = serverSupabase()

  // 사용자 존재 및 역할 확인
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!targetUser) return apiError('사용자를 찾을 수 없습니다.', 404)
  if (targetUser.role !== 'agency_staff') return apiError('agency_staff 역할만 권한 설정이 가능합니다.', 400)

  // 병원 배정 업데이트 (delete + insert)
  if (Array.isArray(assigned_clinic_ids)) {
    await supabase.from('user_clinic_assignments').delete().eq('user_id', userId)
    if (assigned_clinic_ids.length > 0) {
      const rows = assigned_clinic_ids.map((clinic_id: number) => ({ user_id: userId, clinic_id }))
      const { error } = await supabase.from('user_clinic_assignments').insert(rows)
      if (error) return apiError('병원 배정 저장 실패: ' + error.message, 500)
    }
  }

  // 메뉴 권한 업데이트 (delete + insert)
  if (Array.isArray(menu_permissions)) {
    await supabase.from('user_menu_permissions').delete().eq('user_id', userId)
    if (menu_permissions.length > 0) {
      const rows = menu_permissions.map((menu_key: string) => ({ user_id: userId, menu_key }))
      const { error } = await supabase.from('user_menu_permissions').insert(rows)
      if (error) return apiError('메뉴 권한 저장 실패: ' + error.message, 500)
    }
  }

  return apiSuccess({ success: true })
})
