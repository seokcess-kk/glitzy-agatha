import { Badge, type BadgeProps } from '@/components/ui/badge'
import { normalizeChannel } from '@/lib/channel'

type ChannelVariant = NonNullable<BadgeProps['variant']>

interface ChannelBadgeProps {
  channel: string
  className?: string
}

const getChannelVariant = (channel: string): ChannelVariant => {
  const lower = channel?.toLowerCase() || ''
  if (lower.includes('meta') || lower.includes('페이스북') || lower.includes('facebook') || lower.includes('인스타') || lower.includes('instagram')) return 'meta'
  if (lower.includes('google') || lower.includes('구글') || lower.includes('youtube') || lower.includes('유튜브')) return 'google'
  if (lower.includes('tiktok') || lower.includes('틱톡')) return 'tiktok'
  if (lower.includes('naver') || lower.includes('네이버')) return 'naver'
  if (lower.includes('kakao') || lower.includes('카카오')) return 'kakao'
  if (lower.includes('dable') || lower.includes('데이블')) return 'dable'
  return 'secondary'
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const label = normalizeChannel(channel)
  return (
    <Badge variant={getChannelVariant(channel)} className={className}>
      {label}
    </Badge>
  )
}
