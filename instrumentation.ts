export async function register() {
  // 서버 시작 시 환경변수 검증 (서버 사이드만)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/security')

    try {
      validateEnv()
      console.log('[Security] Environment variables validated successfully')
    } catch (error) {
      console.error('[Security] Environment validation failed:', error)
      // 개발 환경에서는 경고만, 프로덕션에서는 중단
      if (process.env.NODE_ENV === 'production') {
        throw error
      }
    }
  }
}
