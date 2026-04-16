import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { isDemoPageAllowed } from '@/lib/demo/guard'

/**
 * next-auth 인증 + demo_viewer 페이지 격리 (Layer 4)
 * - 매처가 /api/* 를 제외하므로 이 미들웨어는 페이지 경로만 처리
 * - API 경로 격리는 lib/api-middleware.ts 의 assertDemoApiAllowed 에서 담당
 *
 * demo_viewer 동작:
 *   - 허용 페이지(/, /ads, /patients, /campaigns) 외 → / 리다이렉트
 *   - 응답에 X-Robots-Tag: noindex, nofollow 주입
 */
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role
    if (role !== 'demo_viewer') return NextResponse.next()

    const { pathname } = req.nextUrl
    if (!isDemoPageAllowed(pathname)) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    const res = NextResponse.next()
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return res
  }
)

export const config = {
  // api/auth, api/webhook, api/qstash, login, lp(랜딩페이지), privacy, terms, demo 는 인증 불필요
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|lp|privacy|terms|demo).*)'],
}
