import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { serverSupabase } from '@/lib/supabase'
import { withClientAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import type { ClientContext } from '@/lib/api-middleware'

// DELETE — 초대 취소
export const DELETE = withClientAdmin(async (req: Request, { user }: ClientContext) => {
  try {
    const url = new URL(req.url)
    const id = parseId(url.pathname.split('/').pop() || '')
    if (!id) return apiError('유효하지 않은 ID입니다.', 400)

    const supabase = serverSupabase()

    // 초대 존재 확인
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, client_id, status')
      .eq('id', id)
      .single()

    if (!invitation) return apiError('초대를 찾을 수 없습니다.', 404)

    // client_admin은 자기 클라이언트만
    if (user.role === 'client_admin' && invitation.client_id !== user.client_id) {
      return apiError('권한이 없습니다.', 403)
    }

    if (invitation.status !== 'pending') {
      return apiError('대기 중인 초대만 취소할 수 있습니다.', 400)
    }

    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) return apiError('초대 취소에 실패했습니다.', 500)

    return apiSuccess({ success: true })
  } catch {
    return apiError('초대 취소 중 오류가 발생했습니다.', 500)
  }
})

// POST — 초대 재발송 (새 토큰 + 만료일 갱신)
export const POST = withClientAdmin(async (req: Request, { user }: ClientContext) => {
  try {
    const url = new URL(req.url)
    const id = parseId(url.pathname.split('/').pop() || '')
    if (!id) return apiError('유효하지 않은 ID입니다.', 400)

    const supabase = serverSupabase()

    // 초대 존재 확인
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, client_id, status')
      .eq('id', id)
      .single()

    if (!invitation) return apiError('초대를 찾을 수 없습니다.', 404)

    // client_admin은 자기 클라이언트만
    if (user.role === 'client_admin' && invitation.client_id !== user.client_id) {
      return apiError('권한이 없습니다.', 403)
    }

    if (invitation.status !== 'pending') {
      return apiError('대기 중인 초대만 재발송할 수 있습니다.', 400)
    }

    // 새 토큰 + 만료일 갱신
    const newToken = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from('invitations')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) return apiError('초대 재발송에 실패했습니다.', 500)

    return apiSuccess(data)
  } catch {
    return apiError('초대 재발송 중 오류가 발생했습니다.', 500)
  }
})
