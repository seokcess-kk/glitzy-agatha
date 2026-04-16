/**
 * UTM 파라미터 처리 유틸리티
 * Phase 1: 데이터 연결
 */

export interface UtmParams {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
}

/**
 * URL에서 UTM 파라미터 추출
 */
export function parseUtmFromUrl(url: string): UtmParams {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams

    return {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
    }
  } catch {
    return {}
  }
}

/**
 * UTM 파라미터 sanitize (XSS 방지, 길이 제한)
 */
export function sanitizeUtmParam(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null

  // 위험 문자 제거
  const sanitized = value
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, maxLength)

  return sanitized || null
}

/**
 * UTM 파라미터 객체 전체 sanitize
 */
export function sanitizeUtmParams(params: Partial<UtmParams>): UtmParams {
  return {
    utm_source: sanitizeUtmParam(params.utm_source, 50),
    utm_medium: sanitizeUtmParam(params.utm_medium, 50),
    utm_campaign: sanitizeUtmParam(params.utm_campaign, 100),
    utm_content: sanitizeUtmParam(params.utm_content, 200),
    utm_term: sanitizeUtmParam(params.utm_term, 100),
  }
}

/**
 * UTM 파라미터 병합 (명시적 값 > URL에서 추출한 값)
 *
 * @param explicit - API 요청으로 직접 전달된 UTM 파라미터
 * @param fromUrl - inflow_url에서 추출한 UTM 파라미터
 * @returns 병합된 UTM 파라미터 (명시적 값 우선)
 */
export function mergeUtmParams(explicit: Partial<UtmParams>, fromUrl: UtmParams): UtmParams {
  return {
    utm_source: explicit.utm_source || fromUrl.utm_source || null,
    utm_medium: explicit.utm_medium || fromUrl.utm_medium || null,
    utm_campaign: explicit.utm_campaign || fromUrl.utm_campaign || null,
    utm_content: explicit.utm_content || fromUrl.utm_content || null,
    utm_term: explicit.utm_term || fromUrl.utm_term || null,
  }
}

/**
 * UTM source를 표시용 라벨로 변환
 */
export function getUtmSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Unknown'

  const labels: Record<string, string> = {
    'meta': 'Meta',
    'facebook': 'Meta',
    'instagram': 'Instagram',
    'google': 'Google',
    'naver': 'Naver',
    'kakao': 'Kakao',
    'tiktok': 'TikTok',
    'youtube': 'YouTube',
    'phone': 'Phone',
    'direct': 'Direct',
  }

  return labels[source.toLowerCase()] || source
}

/**
 * UTM medium을 표시용 라벨로 변환
 */
export function getUtmMediumLabel(medium: string | null | undefined): string {
  if (!medium) return ''

  const labels: Record<string, string> = {
    'cpc': 'CPC 광고',
    'display': '디스플레이',
    'video': '동영상',
    'short': '숏폼',
    'social': '소셜',
    'blog': '블로그',
    'organic': '자연유입',
    'referral': '레퍼럴',
    'email': '이메일',
  }

  return labels[medium.toLowerCase()] || medium
}

/**
 * UTM 파라미터로 URL 빌드
 */
export interface BuildUtmUrlOptions {
  baseUrl: string
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  adGroup?: string // content 앞에 prefix로 결합
}

export function buildUtmUrl(options: BuildUtmUrlOptions): string | null {
  const { baseUrl, source, medium, campaign, content, term, adGroup } = options

  if (!baseUrl?.trim()) return null

  try {
    const urlStr = baseUrl.trim().startsWith('http')
      ? baseUrl.trim()
      : 'https://' + baseUrl.trim()

    const url = new URL(urlStr)

    if (source) url.searchParams.set('utm_source', source)
    if (medium) url.searchParams.set('utm_medium', medium)
    if (campaign) url.searchParams.set('utm_campaign', campaign)

    // adGroup + content 결합
    const contentVal = adGroup && content
      ? `${adGroup}_${content}`
      : adGroup || content
    if (contentVal) url.searchParams.set('utm_content', contentVal)

    if (term) url.searchParams.set('utm_term', term)

    return url.toString()
  } catch {
    return null
  }
}
