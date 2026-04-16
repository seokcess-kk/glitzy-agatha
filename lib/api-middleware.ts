/**
 * API 라우트 공통 미들웨어
 * - 인증 검증
 * - client_id 필터링
 * - superadmin 권한 검증
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { timingSafeEqual } from 'crypto'
import { authOptions } from './auth'
import { getClientId } from './session'
import { SessionUser } from './security'
import { serverSupabase } from './supabase'

// AuthUser를 SessionUser의 별칭으로 export (하위 호환성)
export type AuthUser = SessionUser

// 컨텍스트 타입
export interface AuthContext {
  user: AuthUser
}

export interface ClientContext extends AuthContext {
  clientId: number | null
  /** agency_staff가 client_id 미지정 시, 배정된 클라이언트 ID 목록. 그 외 역할은 null */
  assignedClientIds: number[] | null
}

// 핸들러 타입
type AuthHandler = (req: Request, context: AuthContext) => Promise<NextResponse>
type ClientHandler = (req: Request, context: ClientContext) => Promise<NextResponse>
type SuperAdminHandler = (req: Request, context: AuthContext) => Promise<NextResponse>
type ClientAdminHandler = (req: Request, context: ClientContext) => Promise<NextResponse>

// 인증 실패 응답 (매번 새 Response 생성 — Response body는 1회만 소비 가능)
const UNAUTHORIZED = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const FORBIDDEN_SUPERADMIN = () => NextResponse.json({ error: 'Forbidden: superadmin only' }, { status: 403 })
const FORBIDDEN_CLIENT_ADMIN = () => NextResponse.json({ error: 'Forbidden: client_admin 이상 권한 필요' }, { status: 403 })

/**
 * 세션에서 인증된 사용자 추출 + password_version 검증
 * @returns AuthUser 또는 null (미인증 또는 세션 무효화 시)
 */
async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as AuthUser

  // password_version 검증: 비밀번호 변경 시 기존 세션 무효화
  // 토큰에 password_version이 있는 경우에만 검증 (레거시 세션은 통과)
  const tokenPV = user.password_version
  if (user.id && typeof tokenPV === 'number') {
    const supabase = serverSupabase()
    const { data: dbUser } = await supabase
      .from('users')
      .select('password_version')
      .eq('id', parseInt(user.id, 10))
      .single()

    if (dbUser && dbUser.password_version !== tokenPV) {
      return null // 세션 무효화
    }
  }

  return user
}

/**
 * agency_staff의 배정 클라이언트 ID 목록 조회
 */
async function getAssignedClientIds(userId: string): Promise<number[]> {
  const supabase = serverSupabase()
  const { data } = await supabase
    .from('user_client_assignments')
    .select('client_id')
    .eq('user_id', parseInt(userId, 10))
  return (data || []).map((d: any) => d.client_id)
}

/**
 * 인증 필수 래퍼
 * - 로그인한 사용자만 접근 가능
 */
export function withAuth(handler: AuthHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED()
    return handler(req, { user })
  }
}

/**
 * 인증 + client_id 필터 래퍼
 * - clientId가 자동으로 추출됨
 * - superadmin은 ?client_id=X 파라미터로 특정 클라이언트 조회 가능
 * - agency_staff는 ?client_id=X (배정된 클라이언트만) 또는 미지정 시 assignedClientIds 제공
 * - client_admin은 자신의 클라이언트만 조회
 */
export function withClientFilter(handler: ClientHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED()

    const clientId = await getClientId(req.url)

    // agency_staff가 client_id 미지정 시: 배정된 클라이언트 목록을 제공
    let assignedClientIds: number[] | null = null
    if (user.role === 'agency_staff' && clientId === null) {
      assignedClientIds = await getAssignedClientIds(user.id)
    }

    return handler(req, { user, clientId, assignedClientIds })
  }
}

/**
 * superadmin 전용 래퍼
 * - superadmin 역할만 접근 가능
 */
export function withSuperAdmin(handler: SuperAdminHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED()
    if (user.role !== 'superadmin') return FORBIDDEN_SUPERADMIN()
    return handler(req, { user })
  }
}

/**
 * client_admin 이상 권한 래퍼
 * - superadmin 또는 client_admin만 접근 가능
 * - client_staff, agency_staff는 차단
 */
export function withClientAdmin(handler: ClientAdminHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const user = await getAuthUser()
    if (!user) return UNAUTHORIZED()
    if (user.role !== 'superadmin' && user.role !== 'client_admin') return FORBIDDEN_CLIENT_ADMIN()

    const clientId = await getClientId(req.url)
    return handler(req, { user, clientId, assignedClientIds: null })
  }
}

/**
 * Supabase 쿼리에 client_id 필터를 적용하는 헬퍼
 * - clientId가 있으면 eq('client_id', clientId) 적용
 * - agency_staff가 clientId 미지정이면 in('client_id', assignedClientIds) 적용
 * - superadmin이 clientId 미지정이면 필터 없음 (전체 조회)
 *
 * @returns 필터 적용된 쿼리, 또는 agency_staff 배정 클라이언트이 0개면 null (빈 결과 반환용)
 */
export function applyClientFilter<T extends { eq: Function; in: Function }>(
  query: T,
  { clientId, assignedClientIds }: Pick<ClientContext, 'clientId' | 'assignedClientIds'>,
  column: string = 'client_id'
): T | null {
  if (clientId) {
    return query.eq(column, clientId)
  }
  if (assignedClientIds !== null) {
    if (assignedClientIds.length === 0) return null
    return query.in(column, assignedClientIds)
  }
  return query
}

/**
 * Supabase 쿼리에 날짜 범위 필터를 적용하는 헬퍼
 */
export function applyDateRange<T extends { gte: Function; lte: Function }>(
  query: T,
  dateField: string,
  startDate: string | null,
  endDate: string | null
): T {
  let q = query
  if (startDate) q = q.gte(dateField, startDate)
  if (endDate) q = q.lte(dateField, endDate)
  return q
}

/**
 * 외부 서비스 API 래퍼 (SERVICE_KEY 기반 인증)
 * - glitzy-web 등 외부 서비스에서 Agatha 데이터를 조회할 때 사용
 * - Authorization: Bearer {EXTERNAL_SERVICE_KEY} 헤더 검증
 */
type ExternalHandler = (req: Request) => Promise<NextResponse>

export function withExternalAuth(handler: ExternalHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const key = process.env.EXTERNAL_SERVICE_KEY
    if (!key) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // timing-safe 비교 (timing attack 방지)
    const tokenBuf = Buffer.from(token)
    const keyBuf = Buffer.from(key)
    if (tokenBuf.length !== keyBuf.length || !timingSafeEqual(tokenBuf, keyBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return handler(req)
  }
}

/**
 * API 에러 응답 헬퍼
 */
export function apiError(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * API 성공 응답 헬퍼
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}
