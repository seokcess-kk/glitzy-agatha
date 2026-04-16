import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { sanitizeString, parseId, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('AdminUsers')

export const GET = withSuperAdmin(async () => {
  try {
    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('users')
      .select('id, phone_number, name, role, client_id, is_active, created_at, client:clients(name)')
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
    const { phone_number, name, password, role, client_id, assigned_client_ids, menu_permissions } = await req.json()

    // 필수값 검증
    if (!phone_number || !password) {
      return apiError('휴대폰 번호와 비밀번호를 입력해주세요.', 400)
    }

    // 휴대폰 번호 형식 검증
    if (!isValidPhoneNumber(phone_number)) {
      return apiError('올바른 휴대폰 번호를 입력해주세요. (010으로 시작, 11자리)', 400)
    }

    // 비밀번호 강도 검증
    if (password.length < 8) {
      return apiError('비밀번호는 최소 8자 이상이어야 합니다.', 400)
    }

    // 역할 검증
    const validRoles = ['superadmin', 'client_admin', 'client_staff', 'agency_staff']
    if (!validRoles.includes(role)) {
      return apiError('유효하지 않은 역할입니다.', 400)
    }

    if ((role === 'client_admin' || role === 'client_staff') && !client_id) {
      return apiError('클라이언트를 선택해주세요.', 400)
    }

    if (role === 'agency_staff' && (!Array.isArray(assigned_client_ids) || assigned_client_ids.length === 0)) {
      return apiError('에이전시 담당자는 최소 1개 클라이언트를 배정해야 합니다.', 400)
    }

    const password_hash = await bcrypt.hash(password, 12)
    const normalizedPhone = normalizePhoneNumber(phone_number)
    const supabase = serverSupabase()

    // agency_staff, superadmin은 client_id NULL
    const userClientId = (role === 'superadmin' || role === 'agency_staff') ? null : (client_id || null)

    const { data, error } = await supabase
      .from('users')
      .insert({
        phone_number: normalizedPhone,
        name: name ? sanitizeString(name, 50) : null,
        password_hash,
        role,
        client_id: userClientId,
      })
      .select('id, phone_number, name, role, client_id, is_active, created_at')
      .single()

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return apiError('이미 등록된 휴대폰 번호입니다.', 400)
      }
      return apiError(error.message, 500)
    }

    // agency_staff: 클라이언트 배정 + 메뉴 권한 저장
    if (role === 'agency_staff' && data) {
      const userId = data.id

      if (assigned_client_ids?.length > 0) {
        const clientRows = assigned_client_ids.map((cid: number) => ({ user_id: userId, client_id: cid }))
        const { error: assignError } = await supabase.from('user_client_assignments').insert(clientRows)
        if (assignError) {
          await supabase.from('users').delete().eq('id', userId)
          return apiError('클라이언트 배정 실패: ' + assignError.message, 500)
        }
      }

      if (Array.isArray(menu_permissions) && menu_permissions.length > 0) {
        const menuRows = menu_permissions.map((key: string) => ({ user_id: userId, menu_key: key }))
        const { error: menuError } = await supabase.from('user_menu_permissions').insert(menuRows)
        if (menuError) {
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
      .select('id, phone_number, is_active')
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('사용자 수정 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
