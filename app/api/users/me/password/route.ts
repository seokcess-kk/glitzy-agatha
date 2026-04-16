import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { withAuth, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { sanitizeString } from '@/lib/security'

export const PUT = withAuth(async (req, { user }) => {
  const body = await req.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return apiError('현재 비밀번호와 새 비밀번호를 입력해주세요.')
  }

  if (newPassword.length < 8) {
    return apiError('새 비밀번호는 8자 이상이어야 합니다.')
  }

  const supabase = serverSupabase()

  // 현재 사용자 조회
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, password_hash, password_version')
    .eq('id', parseInt(user.id, 10))
    .single()

  if (!dbUser) {
    return apiError('사용자를 찾을 수 없습니다.', 404)
  }

  // 현재 비밀번호 검증
  const valid = await bcrypt.compare(currentPassword, dbUser.password_hash)
  if (!valid) {
    return apiError('현재 비밀번호가 올바르지 않습니다.')
  }

  // 새 비밀번호 해싱 + password_version 증가
  const newHash = await bcrypt.hash(newPassword, 12)
  const newVersion = (dbUser.password_version ?? 1) + 1

  const { error } = await supabase
    .from('users')
    .update({
      password_hash: newHash,
      password_version: newVersion,
    })
    .eq('id', dbUser.id)

  if (error) {
    return apiError('비밀번호 변경에 실패했습니다.', 500)
  }

  // 활동 로그
  logActivity(supabase, {
    userId: user.id,
    clientId: user.client_id,
    action: 'password_change',
    targetTable: 'users',
    targetId: dbUser.id,
  })

  return apiSuccess({ message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.' })
})
