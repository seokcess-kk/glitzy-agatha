/**
 * 채널별 HEX 색상 매핑 (차트용)
 * Badge variant(components/ui/badge.tsx)의 색상과 동기화
 */

export const CHANNEL_COLORS: Record<string, string> = {
  Meta: '#3b82f6',       // blue-500 (Badge: meta)
  Google: '#ef4444',     // red-500 (Badge: google)
  TikTok: '#ec4899',     // pink-500 (Badge: tiktok)
  Naver: '#22c55e',      // green-500 (Badge: naver)
  Kakao: '#eab308',      // yellow-500 (Badge: kakao)
  YouTube: '#ef4444',    // red-500 (Google 계열)
  Instagram: '#3b82f6',  // blue-500 (Meta 계열)
  Phone: '#8b5cf6',      // violet-500
  Direct: '#3b82f6',     // blue-500
  Organic: '#14b8a6',    // teal-500
  Dable: '#6366f1',      // indigo-500 (Badge: dable)
}

const DEFAULT_COLOR = '#64748b' // slate-500

/**
 * 정규화된 채널명으로 차트용 HEX 색상 반환
 * normalizeChannel() 결과값 기준 (Meta, Google, TikTok 등)
 */
export function getChannelColor(channel: string): string {
  if (!channel) return DEFAULT_COLOR

  // 정확히 매칭
  if (CHANNEL_COLORS[channel]) return CHANNEL_COLORS[channel]

  // 부분 매칭 (한글 채널명 등)
  const lower = channel.toLowerCase()
  if (lower.includes('meta') || lower.includes('facebook') || lower.includes('인스타') || lower.includes('instagram')) return CHANNEL_COLORS.Meta
  if (lower.includes('google') || lower.includes('구글')) return CHANNEL_COLORS.Google
  if (lower.includes('youtube') || lower.includes('유튜브')) return CHANNEL_COLORS.YouTube
  if (lower.includes('tiktok') || lower.includes('틱톡')) return CHANNEL_COLORS.TikTok
  if (lower.includes('naver') || lower.includes('네이버')) return CHANNEL_COLORS.Naver
  if (lower.includes('kakao') || lower.includes('카카오')) return CHANNEL_COLORS.Kakao
  if (lower.includes('dable') || lower.includes('데이블')) return CHANNEL_COLORS.Dable

  return DEFAULT_COLOR
}
