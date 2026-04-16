/**
 * 환경변수 검증 모듈
 * - 서비스별 필수 환경변수 그룹 정의
 * - 앱 시작 시 검증 수행
 */

type EnvGroup = {
  name: string
  required: string[]
  optional?: string[]
}

// 서비스별 환경변수 그룹 정의
const ENV_GROUPS: EnvGroup[] = [
  {
    name: 'Supabase',
    required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    name: 'NextAuth',
    required: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
  },
  {
    name: 'Cron',
    required: ['CRON_SECRET'],
  },
  {
    name: 'Google Ads',
    required: [],
    optional: [
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'GOOGLE_ADS_REFRESH_TOKEN',
    ],
  },
  {
    name: 'Meta Ads',
    required: [],
    optional: ['META_APP_ID', 'META_APP_SECRET', 'META_PIXEL_ID', 'META_ACCESS_TOKEN'],
  },
  {
    name: 'TikTok Ads',
    required: [],
    optional: ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET', 'TIKTOK_ADVERTISER_ID', 'TIKTOK_ACCESS_TOKEN'],
  },
  {
    name: 'QStash',
    required: [],
    optional: [
      'QSTASH_TOKEN',
      'QSTASH_CURRENT_SIGNING_KEY',
      'QSTASH_NEXT_SIGNING_KEY',
    ],
  },
  {
    name: 'Kakao',
    required: [],
    optional: [
      'KAKAO_API_KEY',
      'KAKAO_SENDER_KEY',
      'KAKAO_USER_ID',
      'KAKAO_TEMPLATE_CODE',
      'KAKAO_SENDER_NUMBER',
    ],
  },
  {
    name: 'ERP (glitzy-web)',
    required: [],
    optional: ['ERP_API_URL', 'ERP_SERVICE_KEY'],
  },
  {
    name: 'External API (inbound)',
    required: [],
    optional: ['EXTERNAL_SERVICE_KEY'],
  },
  {
    name: 'AI',
    required: [],
    optional: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
  },
]

export interface EnvValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 환경변수 검증
 * @param throwOnError true면 에러 시 예외 발생, false면 결과 객체 반환
 */
export function validateEnv(throwOnError: boolean = false): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const group of ENV_GROUPS) {
    // 필수 환경변수 검증
    const missingRequired = group.required.filter((key) => !process.env[key])
    if (missingRequired.length > 0) {
      errors.push(`[${group.name}] 필수 환경변수 누락: ${missingRequired.join(', ')}`)
    }

    // 선택 환경변수 중 일부만 설정된 경우 경고
    if (group.optional && group.optional.length > 0) {
      const setOptional = group.optional.filter((key) => process.env[key])
      const unsetOptional = group.optional.filter((key) => !process.env[key])

      // 일부만 설정된 경우 (전체 설정 또는 전체 미설정이 아닌 경우)
      if (setOptional.length > 0 && unsetOptional.length > 0) {
        warnings.push(
          `[${group.name}] 일부 환경변수만 설정됨. 누락: ${unsetOptional.join(', ')}`
        )
      }
    }
  }

  const result: EnvValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  }

  if (throwOnError && !result.valid) {
    throw new Error(`환경변수 검증 실패:\n${errors.join('\n')}`)
  }

  return result
}
