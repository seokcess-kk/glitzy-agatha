import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { serverSupabase } from '@/lib/supabase'
import { withClientAdmin, apiSuccess, apiError } from '@/lib/api-middleware'
import type { ClientContext } from '@/lib/api-middleware'

// GET — 초대 목록 조회
export const GET = withClientAdmin(async (req: Request, { user, clientId }: ClientContext) => {
  try {
    const supabase = serverSupabase()

    let query = supabase
      .from('invitations')
      .select('*, client:clients(name), inviter:users!invitations_invited_by_fkey(name)')
      .order('created_at', { ascending: false })

    // superadmin: 전체, client_admin: 자기 클라이언트
    if (user.role === 'client_admin') {
      const cid = clientId || user.client_id
      if (!cid) return apiError('클라이언트 정보가 없습니다.', 400)
      query = query.eq('client_id', cid)
    } else if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query

    if (error) {
      return apiError('초대 목록 조회에 실패했습니다.', 500)
    }

    return apiSuccess(data || [])
  } catch {
    return apiError('초대 목록 조회 중 오류가 발생했습니다.', 500)
  }
})

// POST — 초대 생성
export const POST = withClientAdmin(async (req: Request, { user, clientId }: ClientContext) => {
  try {
    const body = await req.json()
    const { client_id: bodyClientId, role, expires_days = 7 } = body

    // client_id 결정
    const targetClientId = user.role === 'superadmin'
      ? (bodyClientId || clientId)
      : (user.client_id || clientId)

    if (!targetClientId) {
      return apiError('클라이언트 ID가 필요합니다.', 400)
    }

    // 역할 검증
    const allowedRoles = ['client_admin', 'client_staff']
    if (!role || !allowedRoles.includes(role)) {
      return apiError('올바른 역할을 선택해주세요. (client_admin, client_staff)', 400)
    }

    // client_admin은 자기 클라이언트에만 초대 가능
    if (user.role === 'client_admin' && targetClientId !== user.client_id) {
      return apiError('자신의 클라이언트에만 초대할 수 있습니다.', 403)
    }

    // 토큰 생성
    const token = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_days)

    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        token,
        client_id: targetClientId,
        role,
        invited_by: parseInt(user.id, 10),
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select('*')
      .single()

    if (error) {
      return apiError('초대 생성에 실패했습니다.', 500)
    }

    return apiSuccess(data, 201)
  } catch {
    return apiError('초대 생성 중 오류가 발생했습니다.', 500)
  }
})
