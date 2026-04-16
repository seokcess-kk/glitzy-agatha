import { NextRequest } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { apiSuccess, apiError } from '@/lib/api-middleware'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
      return apiError('토큰이 필요합니다.', 400)
    }

    const supabase = serverSupabase()

    const { data: invitation } = await supabase
      .from('invitations')
      .select('id, status, expires_at, role, client:clients(name)')
      .eq('token', token)
      .single()

    if (!invitation) {
      return apiError('유효하지 않은 초대 링크입니다.', 404)
    }

    if (invitation.status !== 'pending') {
      return apiError('이미 사용된 초대 링크입니다.', 400)
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return apiError('만료된 초대 링크입니다.', 400)
    }

    const clientName = (invitation.client as any)?.name || '알 수 없음'

    return apiSuccess({
      valid: true,
      clientName,
      role: invitation.role,
    })
  } catch (error) {
    return apiError('토큰 검증 중 오류가 발생했습니다.', 500)
  }
}
