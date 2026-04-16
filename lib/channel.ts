/**
 * 채널명 정규화 — 다양한 utm_source/platform 값을 통일된 채널명으로 변환
 * 정확 매칭 → prefix 기반 폴백 (google_search → Google, meta_feed → Meta 등)
 */
export function normalizeChannel(source: string | null | undefined): string {
  if (!source) return 'Unknown'
  const normalized = source.toLowerCase().trim()

  // 1. 정확 매칭
  const exactMap: Record<string, string> = {
    'meta': 'Meta', 'meta_ads': 'Meta', 'facebook': 'Meta', 'fb': 'Meta',
    'google': 'Google', 'google_ads': 'Google', 'gdn': 'Google',
    'youtube': 'YouTube', 'yt': 'YouTube',
    'tiktok': 'TikTok', 'tiktok_ads': 'TikTok',
    'naver': 'Naver', 'naver_ads': 'Naver',
    'kakao': 'Kakao', 'kakao_ads': 'Kakao',
    'dable': 'Dable', 'dable_ads': 'Dable',
    'instagram': 'Instagram', 'ig': 'Instagram',
    'phone': 'Phone',
    'direct': 'Direct',
    'organic': 'Organic',
  }
  if (exactMap[normalized]) return exactMap[normalized]

  // 2. prefix 기반 폴백 (google_search → Google, meta_feed → Meta 등)
  const prefix = normalized.split('_')[0]
  const prefixMap: Record<string, string> = {
    meta: 'Meta', google: 'Google', naver: 'Naver', kakao: 'Kakao',
    tiktok: 'TikTok', youtube: 'YouTube', dable: 'Dable',
    facebook: 'Meta', instagram: 'Instagram',
  }
  if (prefixMap[prefix]) return prefixMap[prefix]

  return source
}
