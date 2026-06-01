import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { serverSupabase } from './supabase'
import { createLogger } from './logger'

const logger = createLogger('Session')

/**
 * client_id 파라미터가 명시적으로 전달됐으나 무효/비활성/미배정인 경우 던지는 에러.
 * 미들웨어가 잡아 400/403 으로 응답한다. (조용히 null=전체조회 로 떨어지면
 * 잘못된/오래된 선택이 "데이터 없음"이 아니라 "전체 데이터"로 표시되는 신뢰성 리스크가 생김)
 */
export class ClientAccessError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'ClientAccessError'
    this.status = status
  }
}

/**
 * 현재 세션의 client_id 반환
 * - superadmin: URL 쿼리 ?client_id=X 가 있으면 그 값 (검증 후), 없으면 null (전체 보기)
 * - client_admin: 세션의 client_id 고정
 *
 * client_id 가 명시됐으나 무효/비활성/미배정이면 ClientAccessError 를 던진다 (전체조회 폴백 금지).
 * 파라미터 자체가 없으면(=의도적 전체 보기) 기존대로 null.
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
            throw new ClientAccessError('유효하지 않은 client_id 입니다.', 400)
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
            throw new ClientAccessError('존재하지 않거나 비활성화된 클라이언트입니다.', 403)
          }

          return clientId
        }
      } catch (e) {
        if (e instanceof ClientAccessError) throw e // 무효/비활성 → 미들웨어가 400/403 응답
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
            throw new ClientAccessError('유효하지 않은 client_id 입니다.', 400)
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
            throw new ClientAccessError('해당 클라이언트에 접근 권한이 없습니다.', 403)
          }

          return clientId
        }
      } catch (e) {
        if (e instanceof ClientAccessError) throw e // 미배정/무효 → 미들웨어가 400/403 응답
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
