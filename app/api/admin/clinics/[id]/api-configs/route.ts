/**
 * 병원별 광고 매체 API 키 관리
 * - GET: 설정 조회 (민감 필드 마스킹)
 * - POST: 매체별 API 키 저장 (upsert)
 * - DELETE: 매체 설정 삭제
 */

import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { serverSupabase } from '@/lib/supabase'
import { parseId } from '@/lib/security'
import { encryptApiConfig, decryptApiConfig } from '@/lib/crypto'
import { archiveBeforeDelete } from '@/lib/archive'
import { createLogger } from '@/lib/logger'
import { API_CONFIG_PLATFORMS, API_REQUIRED_FIELDS, isApiPlatform, type ApiPlatform } from '@/lib/platform'

const logger = createLogger('ApiConfigs')

/** 민감 필드 목록 — 마지막 4자 외에는 **** 로 마스킹 */
const SENSITIVE_FIELDS = ['access_token', 'client_secret', 'refresh_token']

function maskSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (SENSITIVE_FIELDS.includes(key) && typeof value === 'string' && value.length > 4) {
      masked[key] = '****' + value.slice(-4)
    } else {
      masked[key] = value
    }
  }
  return masked
}

function isAllowedPlatform(platform: unknown): platform is ApiPlatform {
  return isApiPlatform(platform)
}

/** config 필드값 길이 제한 (API 토큰은 특수문자 포함 가능하므로 XSS sanitize 하지 않음) */
const MAX_CONFIG_VALUE_LENGTH = 500

function validateConfigValues(config: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.length > MAX_CONFIG_VALUE_LENGTH) {
      return `${key} 값이 너무 깁니다. (최대 ${MAX_CONFIG_VALUE_LENGTH}자)`
    }
  }
  return null
}

/**
 * GET: 해당 병원의 광고 매체 설정 조회
 */
export const GET = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // pathname: /api/admin/clinics/[id]/api-configs
  const idSegment = segments[segments.indexOf('clinics') + 1]
  const clinicId = parseId(idSegment)
  if (!clinicId) return apiError('유효한 병원 ID가 필요합니다.')

  const supabase = serverSupabase()

  try {
    const { data, error } = await supabase
      .from('clinic_api_configs')
      .select('platform, config, is_active, last_tested_at, last_test_result')
      .eq('clinic_id', clinicId)
      .in('platform', API_CONFIG_PLATFORMS as unknown as string[])

    if (error) {
      logger.error('clinic_api_configs 조회 실패', error, { clinicId })
      return apiError('서버 오류가 발생했습니다.', 500)
    }

    const result = (data || []).map((row) => {
      // JSONB에서 꺼낸 값이 객체(평문)이면 직접 사용, 문자열(암호화)이면 복호화
      const rawConfig = row.config
      const decrypted = typeof rawConfig === 'object' && rawConfig !== null
        ? rawConfig as Record<string, unknown>
        : decryptApiConfig(rawConfig as string)
      return {
        platform: row.platform,
        config: decrypted ? maskSensitiveFields(decrypted) : null,
        is_active: row.is_active,
        last_tested_at: row.last_tested_at,
        last_test_result: row.last_test_result,
      }
    })

    return apiSuccess(result)
  } catch (error) {
    logger.error('API 설정 조회 중 예외', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

/**
 * POST: 매체별 API 키 저장 (upsert)
 */
export const POST = withSuperAdmin(async (req: Request) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const idSegment = segments[segments.indexOf('clinics') + 1]
  const clinicId = parseId(idSegment)
  if (!clinicId) return apiError('유효한 병원 ID가 필요합니다.')

  let body: { platform?: unknown; config?: unknown; is_active?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.')
  }

  const { platform, config } = body
  const isActive = typeof body.is_active === 'boolean' ? body.is_active : true

  if (!isAllowedPlatform(platform)) {
    return apiError(`허용되지 않는 플랫폼입니다. (${API_CONFIG_PLATFORMS.join(', ')})`)
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return apiError('config 객체가 필요합니다.')
  }

  // platform별 필수 필드 검증
  const requiredFields = API_REQUIRED_FIELDS[platform]
  const configObj = config as Record<string, unknown>
  const missingFields = requiredFields.filter(f => !configObj[f] || (typeof configObj[f] === 'string' && configObj[f].toString().trim() === ''))
  if (missingFields.length > 0) {
    return apiError(`필수 필드가 누락되었습니다: ${missingFields.join(', ')}`)
  }

  // 값 길이 검증 (API 토큰은 특수문자 포함 가능하므로 XSS sanitize 제외)
  const lengthError = validateConfigValues(configObj)
  if (lengthError) return apiError(lengthError)

  // JSONB 컬럼에 저장: 암호화 키 있으면 암호화 문자열, 없으면 객체 직접 저장
  const encryptionKey = process.env.API_ENCRYPTION_KEY
  const configValue = encryptionKey ? encryptApiConfig(configObj) : configObj
  const supabase = serverSupabase()

  try {
    const { error } = await supabase
      .from('clinic_api_configs')
      .upsert(
        {
          clinic_id: clinicId,
          platform,
          config: configValue,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clinic_id,platform' }
      )

    if (error) {
      logger.error('clinic_api_configs upsert 실패', error, { clinicId, platform })
      return apiError('서버 오류가 발생했습니다.', 500)
    }

    logger.info('API 설정 저장 완료', { clinicId, platform })
    return apiSuccess({ success: true, platform })
  } catch (error) {
    logger.error('API 설정 저장 중 예외', error, { clinicId, platform })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})

/**
 * DELETE: 매체 설정 삭제
 */
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const idSegment = segments[segments.indexOf('clinics') + 1]
  const clinicId = parseId(idSegment)
  if (!clinicId) return apiError('유효한 병원 ID가 필요합니다.')

  let body: { platform?: unknown }
  try {
    body = await req.json()
  } catch {
    return apiError('유효한 JSON 본문이 필요합니다.')
  }

  const { platform } = body

  if (!isAllowedPlatform(platform)) {
    return apiError(`허용되지 않는 플랫폼입니다. (${API_CONFIG_PLATFORMS.join(', ')})`)
  }

  const supabase = serverSupabase()

  try {
    // 삭제 전 스냅샷 보관
    const { data: existing } = await supabase
      .from('clinic_api_configs')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('platform', platform)
      .maybeSingle()

    if (existing?.id) {
      await archiveBeforeDelete(supabase, 'clinic_api_configs', existing.id, user.id, clinicId)
    }

    const { error } = await supabase
      .from('clinic_api_configs')
      .delete()
      .eq('clinic_id', clinicId)
      .eq('platform', platform)

    if (error) {
      logger.error('clinic_api_configs 삭제 실패', error, { clinicId, platform })
      return apiError('서버 오류가 발생했습니다.', 500)
    }

    logger.info('API 설정 삭제 완료', { clinicId, platform })
    return apiSuccess({ success: true, platform })
  } catch (error) {
    logger.error('API 설정 삭제 중 예외', error, { clinicId, platform })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
