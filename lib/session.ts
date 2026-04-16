import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { serverSupabase } from './supabase'
import { createLogger } from './logger'

const logger = createLogger('Session')

/**
 * 현재 세션의 client_id 반환
 * - superadmin: URL 쿼리 ?client_id=X 가 있으면 그 값 (검증 후), 없으면 null (전체 보기)
 * - client_admin: 세션의 client_id 고정
 */
export async function getClientId(url?: string): Promise<number | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as { role: string; client_id: number | null }

  // demo_viewer: 쿼리 파라미터만 파싱하고 DB 검증 스킵 (fixture ID는 실 clients 테이블에 없음)
  if (user.role === 'demo_viewer') {
    if (url) {
      try {
        const clientIdParam = new URL(url).searchParams.get('client_id')
        if (clientIdParam) {
          const clientId = parseInt(clientIdParam, 10)
          if (!isNaN(clientId) && clientId >= 1) return clientId
        }
      } catch {
        return null
      }
    }
    return null
  }

  if (user.role === 'superadmin') {
    if (url) {
      try {
        const clientIdParam = new URL(url).searchParams.get('client_id')
        if (clientIdParam) {
          const clientId = parseInt(clientIdParam, 10)

          // 숫자 검증
          if (isNaN(clientId) || clientId < 1) {
            logger.warn('Invalid client_id parameter', { clientIdParam })
            return null
          }

          // 실제 존재하는 client인지 확인
          const supabase = serverSupabase()
          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('id', clientId)
            .eq('is_active', true)
            .single()

          if (!client) {
            logger.warn('Client not found or inactive', { clientId })
            return null
          }

          return clientId
        }
      } catch (e) {
        logger.warn('Failed to parse client_id from URL', { error: String(e) })
        return null
      }
    }
    return null // null = 전체 조회
  }

  // agency_staff: ?client_id=X 파라미터 사용, 배정된 클라이언트만 허용
  if (user.role === 'agency_staff') {
    if (url) {
      const supabase = serverSupabase()
      const userId = parseInt(session.user.id, 10)
      try {
        const clientIdParam = new URL(url).searchParams.get('client_id')
        if (clientIdParam) {
          const clientId = parseInt(clientIdParam, 10)
          if (isNaN(clientId) || clientId < 1) {
            logger.warn('Invalid client_id parameter for agency_staff', { clientIdParam })
            return null
          }

          // 배정된 클라이언트인지 확인
          const { data: assignment } = await supabase
            .from('user_client_assignments')
            .select('id')
            .eq('user_id', userId)
            .eq('client_id', clientId)
            .single()

          if (!assignment) {
            logger.warn('Agency staff not assigned to client', { userId: session.user.id, clientId })
            return null
          }

          return clientId
        }
      } catch (e) {
        logger.warn('Failed to parse client_id from URL for agency_staff', { error: String(e) })
        return null
      }
    }

    // client_id 미지정 → null 반환
    // withClientFilter가 getAssignedClientIds()로 배정 클라이언트 목록을 조회하여 필터링함
    return null
  }

  return user.client_id ?? null
}

export async function getSession() {
  return getServerSession(authOptions)
}

export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role: string } | undefined
  return user?.role === 'superadmin'
}
