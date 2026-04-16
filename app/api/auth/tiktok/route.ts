/**
 * TikTok OAuth2 인증 시작
 * - superadmin만 접근 가능
 * - client_id + CSRF 토큰을 state에 포함하여 TikTok 인증 페이지로 리다이렉트
 */

import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { withSuperAdmin, apiError } from '@/lib/api-middleware'
import { parseId } from '@/lib/security'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('TikTokOAuth')

const TIKTOK_AUTH_URL = 'https://business-api.tiktok.com/portal/auth'

export const GET = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const clientId = parseId(url.searchParams.get('client_id'))

  if (!clientId) {
    return apiError('client_id가 필요합니다.')
  }

  const appId = process.env.TIKTOK_APP_ID
  if (!appId) {
    return apiError('TIKTOK_APP_ID 환경변수가 설정되지 않았습니다.', 500)
  }

  // NEXTAUTH_URL 기반으로 redirect URI 생성
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/auth/tiktok/callback`

  // CSRF 방지용 state 토큰 생성 (client_id + 랜덤 토큰)
  const csrfToken = randomBytes(32).toString('hex')
  const state = JSON.stringify({ clientId, csrfToken })
  const stateBase64 = Buffer.from(state).toString('base64url')

  // DB에 state 토큰 저장 (콜백에서 검증용, 10분 만료)
  const supabase = serverSupabase()
  const { error } = await supabase
    .from('oauth_states')
    .insert({
      state_token: csrfToken,
      client_id: clientId,
      platform: 'tiktok',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

  if (error) {
    logger.error('OAuth state 저장 실패', error, { clientId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }

  // TikTok 인증 페이지로 리다이렉트
  const authUrl = new URL(TIKTOK_AUTH_URL)
  authUrl.searchParams.set('app_id', appId)
  authUrl.searchParams.set('state', stateBase64)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  logger.info('TikTok OAuth 시작', { clientId })

  return NextResponse.redirect(authUrl.toString())
})
