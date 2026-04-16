import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { apiSuccess, apiError } from '@/lib/api-middleware'
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/security'

export async function POST(req: NextRequest) {
  try {
    const { token, name, phone_number, password } = await req.json()

    // 필수값 검증
    if (!token || !name || !phone_number || !password) {
      return apiError('모든 필드를 입력해주세요.', 400)
    }

    // phone_number 유효성 검증
    if (!isValidPhoneNumber(phone_number)) {
      return apiError('올바른 휴대폰 번호를 입력해주세요. (010으로 시작, 11자리)', 400)
    }

    // 비밀번호 길이 검증
    if (password.length < 8) {
      return apiError('비밀번호는 8자 이상이어야 합니다.', 400)
    }

    const normalizedPhone = normalizePhoneNumber(phone_number)
    const supabase = serverSupabase()

    // 1. invitations 테이블에서 token 조회
    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (!invitation) {
      return apiError('유효하지 않은 초대 링크입니다.', 400)
    }

    // 2. 토큰 유효성 검증 (pending 상태, 만료 안 됨)
    if (invitation.status !== 'pending') {
      return apiError('이미 사용된 초대 링크입니다.', 400)
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return apiError('만료된 초대 링크입니다.', 400)
    }

    // 3. phone_number 중복 체크
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .single()

    if (existingUser) {
      return apiError('이미 등록된 휴대폰 번호입니다.', 409)
    }

    // 5. users 테이블에 INSERT (password bcrypt 해시)
    const passwordHash = await bcrypt.hash(password, 12)

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        phone_number: normalizedPhone,
        name,
        password_hash: passwordHash,
        role: invitation.role,
        client_id: invitation.client_id,
        is_active: true,
      })
      .select('id')
      .single()

    if (insertError || !newUser) {
      return apiError('계정 생성에 실패했습니다.', 500)
    }

    // 6. invitations 상태 → completed 업데이트
    await supabase
      .from('invitations')
      .update({
        status: 'completed',
        completed_by: newUser.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    return apiSuccess({ userId: newUser.id }, 201)
  } catch (error) {
    return apiError('회원가입 처리 중 오류가 발생했습니다.', 500)
  }
}
