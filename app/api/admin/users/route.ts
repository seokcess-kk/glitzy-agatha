import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminUsers')

export const GET = withSuperAdmin(async () => {
  try {
    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, clinic_id, is_active, created_at, clinic:clinics(name)')
      .order('created_at', { ascending: false })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('사용자 목록 조회 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

export const POST = withSuperAdmin(async (req: Request, { user }) => {
  try {
    const { username, password, role, clinic_id, assigned_clinic_ids, menu_permissions } = await req.json()

    // 필수값 검증
    if (!username || !password) {
      return apiError('아이디와 비밀번호를 입력해주세요.', 400)
    }

    // 아이디 형식 검증
    const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/
    if (!usernamePattern.test(username)) {
      return apiError('아이디는 영문, 숫자, 밑줄만 사용 가능합니다. (3-30자)', 400)
    }

    // 비밀번호 강도 검증
    if (password.length < 8) {
      return apiError('비밀번호는 최소 8자 이상이어야 합니다.', 400)
    }

    // 역할 검증
    const validRoles = ['superadmin', 'clinic_admin', 'clinic_staff', 'agency_staff']
    if (!validRoles.includes(role)) {
      return apiError('유효하지 않은 역할입니다.', 400)
    }

    if ((role === 'clinic_admin' || role === 'clinic_staff') && !clinic_id) {
      return apiError('병원을 선택해주세요.', 400)
    }

    if (role === 'agency_staff' && (!Array.isArray(assigned_clinic_ids) || assigned_clinic_ids.length === 0)) {
      return apiError('실행사 담당자는 최소 1개 병원을 배정해야 합니다.', 400)
    }

    const password_hash = await bcrypt.hash(password, 12)
    const supabase = serverSupabase()

    // agency_staff, superadmin은 clinic_id NULL
    const userClinicId = (role === 'superadmin' || role === 'agency_staff') ? null : (clinic_id || null)

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: sanitizeString(username, 30),
        password_hash,
        role,
        clinic_id: userClinicId,
      })
      .select('id, username, role, clinic_id, is_active, created_at')
      .single()

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return apiError('이미 존재하는 아이디입니다.', 400)
      }
      return apiError(error.message, 500)
    }

    // agency_staff: 병원 배정 + 메뉴 권한 저장
    if (role === 'agency_staff' && data) {
      const userId = data.id

      if (assigned_clinic_ids?.length > 0) {
        const clinicRows = assigned_clinic_ids.map((cid: number) => ({ user_id: userId, clinic_id: cid }))
        const { error: assignError } = await supabase.from('user_clinic_assignments').insert(clinicRows)
        if (assignError) {
          // 유저는 생성되었으므로 롤백 대신 경고 로그 + 에러 반환
          await supabase.from('users').delete().eq('id', userId)
          return apiError('병원 배정 실패: ' + assignError.message, 500)
        }
      }

      if (Array.isArray(menu_permissions) && menu_permissions.length > 0) {
        const menuRows = menu_permissions.map((key: string) => ({ user_id: userId, menu_key: key }))
        const { error: menuError } = await supabase.from('user_menu_permissions').insert(menuRows)
        if (menuError) {
          // 유저+병원배정은 유지, 메뉴 권한만 실패 → 유저 삭제 롤백 (CASCADE로 배정도 삭제됨)
          await supabase.from('users').delete().eq('id', userId)
          return apiError('메뉴 권한 저장 실패: ' + menuError.message, 500)
        }
      }
    }

    return apiSuccess(data)
  } catch (err) {
    logger.error('사용자 생성 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

export const PATCH = withSuperAdmin(async (req: Request) => {
  try {
    const { id, is_active } = await req.json()

    const userId = parseId(id)
    if (!userId) {
      return apiError('유효한 사용자 ID가 필요합니다.', 400)
    }

    if (typeof is_active !== 'boolean') {
      return apiError('is_active는 boolean 값이어야 합니다.', 400)
    }

    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('users')
      .update({ is_active })
      .eq('id', userId)
      .select('id, username, is_active')
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('사용자 수정 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
