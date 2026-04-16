/**
 * Demo 진입 라우트
 *
 * GET /demo/enter?key=<DEMO_ACCESS_KEY>
 *   - key 검증 (timingSafeEqual)
 *   - demo_viewer 계정을 DB에서 조회
 *   - next-auth JWT를 직접 발급하여 세션 쿠키 설정
 *   - samantha_demo=1 쿠키 설정 (클라이언트 배지/UI 힌트용, 중요 판단은 세션 role 사용)
 *   - / 으로 redirect
 *
 * 보안:
 *   - key는 환경변수에서만 읽음, 요청 바디/쿼리에 노출되지 않음
 *   - 비밀번호는 DB에만 해시로 존재, 진입 시 재사용 안 함 (JWT 직접 발급)
 *   - 쿠키: HttpOnly, Secure, SameSite=Lax, 1시간 만료
 */

import { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { timingSafeEqual } from 'crypto'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('DemoEnter')

const DEMO_USERNAME = 'demo_viewer'
const SESSION_MAX_AGE = 60 * 60 // 1 hour

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  const demoKey = process.env.DEMO_ACCESS_KEY
  const nextAuthSecret = process.env.NEXTAUTH_SECRET

  if (!demoKey || !nextAuthSecret) {
    logger.warn('DEMO_ACCESS_KEY 또는 NEXTAUTH_SECRET 미설정 — demo 모드 비활성')
    return new NextResponse('demo mode disabled', { status: 503 })
  }

  const url = new URL(req.url)
  const providedKey = url.searchParams.get('key') || ''

  if (!safeEqual(providedKey, demoKey)) {
    logger.warn('demo 진입 키 불일치', { ip: req.headers.get('x-forwarded-for') || 'unknown' })
    return new NextResponse('unauthorized', { status: 401 })
  }

  // demo_viewer 계정 조회 (seed-demo-user.ts로 사전 생성)
  const supabase = serverSupabase()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, role, clinic_id, password_version, is_active')
    .eq('username', DEMO_USERNAME)
    .eq('role', 'demo_viewer')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !user) {
    logger.error('demo 계정 조회 실패 — seed-demo-user 실행 필요', { error })
    return new NextResponse('demo account not provisioned', { status: 500 })
  }

  // JWT 직접 발급 (lib/auth.ts의 jwt callback 구조와 일치)
  const token = await encode({
    token: {
      sub: String(user.id),
      name: user.username,
      email: `${user.username}@samantha.local`,
      role: 'demo_viewer',
      clinic_id: null,
      username: user.username,
      password_version: user.password_version ?? 1,
    },
    secret: nextAuthSecret,
    maxAge: SESSION_MAX_AGE,
  })

  const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https://')
  const sessionCookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  res.cookies.set('samantha_demo', '1', {
    httpOnly: false, // 배지 표시 등 UI hint 용도. 보안 판단은 세션 role 기반
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')

  logger.info('demo 세션 진입', { userId: user.id })
  return res
}
