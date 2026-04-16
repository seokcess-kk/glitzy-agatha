import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware() {
    // 인증 통과 시 그대로 진행
  }
)

export const config = {
  // api/auth, api/webhook, api/qstash, login, signup, lp(랜딩페이지), privacy, terms 는 인증 불필요
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|signup|lp|privacy|terms).*)'],
}
