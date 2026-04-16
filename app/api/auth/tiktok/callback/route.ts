/**
 * TikTok OAuth2 콜백
 * - auth_code 수신 → access_token + refresh_token 교환
 * - client_api_configs에 암호화 저장
 * - 관리 페이지로 리다이렉트
 */

import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { encryptApiConfig } from '@/lib/crypto'
import { createLogger } from '@/lib/logger'

const logger = createLogger('TikTokOAuthCallback')

const TIKTOK_TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const authCode = url.searchParams.get('auth_code')
  const stateBase64 = url.searchParams.get('state')
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  // 에러 응답 처리 (TikTok이 에러로 리다이렉트한 경우)
  const errorParam = url.searchParams.get('error')
  if (errorParam) {
    logger.warn('TikTok OAuth 거부', { error: errorParam })
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_denied`
    )
  }

  if (!authCode || !stateBase64) {
    logger.warn('TikTok OAuth 콜백: auth_code 또는 state 누락')
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_invalid_callback`
    )
  }

  // state 디코딩 및 검증
  let clientId: number
  let csrfToken: string
  try {
    const stateJson = Buffer.from(stateBase64, 'base64url').toString('utf-8')
    const parsed = JSON.parse(stateJson)
    clientId = parsed.clientId
    csrfToken = parsed.csrfToken
    if (!clientId || !csrfToken) throw new Error('Invalid state payload')
  } catch {
    logger.warn('TikTok OAuth 콜백: state 파싱 실패')
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_invalid_state`
    )
  }

  // CSRF 토큰 DB 검증
  const supabase = serverSupabase()
  const { data: stateRecord, error: stateError } = await supabase
    .from('oauth_states')
    .select('id, client_id, expires_at')
    .eq('state_token', csrfToken)
    .eq('platform', 'tiktok')
    .eq('client_id', clientId)
    .maybeSingle()

  if (stateError || !stateRecord) {
    logger.warn('TikTok OAuth 콜백: state 토큰 불일치', { clientId })
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_invalid_state`
    )
  }

  // 만료 확인
  if (new Date(stateRecord.expires_at) < new Date()) {
    logger.warn('TikTok OAuth 콜백: state 만료', { clientId })
    await supabase.from('oauth_states').delete().eq('id', stateRecord.id)
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_state_expired`
    )
  }

  // 사용된 state 삭제 (일회용)
  await supabase.from('oauth_states').delete().eq('id', stateRecord.id)

  // TikTok에 auth_code → access_token 교환
  const appId = process.env.TIKTOK_APP_ID
  const appSecret = process.env.TIKTOK_APP_SECRET
  if (!appId || !appSecret) {
    logger.error('TIKTOK_APP_ID 또는 TIKTOK_APP_SECRET 누락')
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_server_error`
    )
  }

  try {
    const tokenResponse = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: authCode,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.code !== 0 || !tokenData.data?.access_token) {
      logger.error('TikTok 토큰 교환 실패', new Error(tokenData.message || 'Unknown error'), {
        clientId,
        code: tokenData.code,
      })
      return NextResponse.redirect(
        `${baseUrl}/admin/settings?error=tiktok_token_error`
      )
    }

    const {
      access_token,
      advertiser_ids,
      refresh_token,
      refresh_token_expires_in,
    } = tokenData.data

    // advertiser_ids 중 첫 번째 사용 (다중 광고주 계정 시 선택 UI 필요 — 현재는 첫 번째)
    const advertiserId = advertiser_ids?.[0]
    if (!advertiserId) {
      logger.error('TikTok 인증 성공했으나 advertiser_id 없음', new Error('No advertiser_ids'), { clientId })
      return NextResponse.redirect(
        `${baseUrl}/admin/settings?error=tiktok_no_advertiser`
      )
    }

    // client_api_configs에 저장 (upsert)
    const configPayload = {
      advertiser_id: advertiserId,
      access_token,
      refresh_token: refresh_token || null,
      refresh_token_expires_at: refresh_token_expires_in
        ? new Date(Date.now() + refresh_token_expires_in * 1000).toISOString()
        : null,
      token_obtained_at: new Date().toISOString(),
    }

    const encryptionKey = process.env.API_ENCRYPTION_KEY
    const configValue = encryptionKey ? encryptApiConfig(configPayload) : configPayload

    const { error: upsertError } = await supabase
      .from('client_api_configs')
      .upsert(
        {
          client_id: clientId,
          platform: 'tiktok_ads',
          config: configValue,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,platform' }
      )

    if (upsertError) {
      logger.error('TikTok API 설정 저장 실패', upsertError, { clientId })
      return NextResponse.redirect(
        `${baseUrl}/admin/settings?error=tiktok_save_error`
      )
    }

    logger.info('TikTok OAuth 연동 완료', {
      clientId,
      advertiserId,
      hasRefreshToken: !!refresh_token,
    })

    return NextResponse.redirect(
      `${baseUrl}/admin/settings?success=tiktok_connected&client_id=${clientId}`
    )
  } catch (error) {
    logger.error('TikTok OAuth 토큰 교환 중 예외', error, { clientId })
    return NextResponse.redirect(
      `${baseUrl}/admin/settings?error=tiktok_server_error`
    )
  }
}
