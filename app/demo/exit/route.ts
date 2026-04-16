/**
 * Demo 퇴장 라우트
 *
 * GET /demo/exit
 *   - next-auth 세션 쿠키 제거
 *   - samantha_demo 쿠키 제거
 *   - /login 으로 redirect
 */

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https://')
  const sessionCookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.set(sessionCookieName, '', { path: '/', maxAge: 0, httpOnly: true, secure: isSecure, sameSite: 'lax' })
  res.cookies.set('samantha_demo', '', { path: '/', maxAge: 0 })
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
