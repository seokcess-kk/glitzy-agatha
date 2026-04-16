import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { withClinicAdmin, apiError, apiSuccess, ClinicContext } from '@/lib/api-middleware'
import { sanitizeString } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Staff')

/**
 * clinic_admin용 담당자(clinic_staff) 관리 API
 * - GET: 자기 병원 담당자 목록
 * - POST: 담당자 생성
 * - PATCH: 활성화/비활성화
 */

export const GET = withClinicAdmin(async (req: Request, { user }: ClinicContext) => {
  try {
    const supabase = serverSupabase()
    const clinicId = user.role === 'superadmin' ? null : user.clinic_id

    let query = supabase
      .from('users')
      .select('id, username, role, clinic_id, is_active, created_at, clinic:clinics(name)')
      .eq('role', 'clinic_staff')
      .order('created_at', { ascending: false })

    if (clinicId) {
      query = query.eq('clinic_id', clinicId)
    }

    const { data, error } = await query
    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('staff 조회 실패', err, { clinicId: user.clinic_id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

export const POST = withClinicAdmin(async (req: Request, { user }: ClinicContext) => {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return apiError('아이디와 비밀번호를 입력해주세요.', 400)
    }

    const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/
    if (!usernamePattern.test(username)) {
      return apiError('아이디는 영문, 숫자, 밑줄만 사용 가능합니다. (3-30자)', 400)
    }

    if (password.length < 8) {
      return apiError('비밀번호는 최소 8자 이상이어야 합니다.', 400)
    }

    // clinic_admin은 자기 병원에만 생성 가능 (superadmin은 /admin/users 사용)
    const clinicId = user.clinic_id
    if (!clinicId) {
      return apiError('담당자 생성은 병원 관리자만 가능합니다. 슈퍼어드민은 계정 관리 페이지를 이용해주세요.', 400)
    }

    const password_hash = await bcrypt.hash(password, 12)
    const supabase = serverSupabase()

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: sanitizeString(username, 30),
        password_hash,
        role: 'clinic_staff',
        clinic_id: clinicId,
      })
      .select('id, username, role, clinic_id, is_active, created_at')
      .single()

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return apiError('이미 존재하는 아이디입니다.', 400)
      }
      return apiError(error.message, 500)
    }
    return apiSuccess(data)
  } catch (err) {
    logger.error('staff 생성 실패', err, { clinicId: user.clinic_id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

export const PATCH = withClinicAdmin(async (req: Request, { user }: ClinicContext) => {
  try {
    const { id, is_active } = await req.json()

    if (!id || typeof is_active !== 'boolean') {
      return apiError('유효한 요청이 아닙니다.', 400)
    }

    const supabase = serverSupabase()

    // 대상 사용자가 자기 병원 소속인지 확인
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, clinic_id, role')
      .eq('id', id)
      .single()

    if (!targetUser || targetUser.role !== 'clinic_staff') {
      return apiError('담당자를 찾을 수 없습니다.', 404)
    }

    if (user.role !== 'superadmin' && targetUser.clinic_id !== user.clinic_id) {
      return apiError('권한이 없습니다.', 403)
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_active })
      .eq('id', id)
      .select('id, username, is_active')
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (err) {
    logger.error('staff 수정 실패', err, { clinicId: user.clinic_id })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
