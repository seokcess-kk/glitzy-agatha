import { Badge } from '@/components/ui/badge'

type StatusVariant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary'

interface StatusBadgeProps {
  status: string
  className?: string
}

const getStatusVariant = (status: string): StatusVariant => {
  const lower = status?.toLowerCase() || ''
  // 성공 상태
  if (lower.includes('완료') || lower.includes('성공') || lower.includes('결제') || lower.includes('확정')) return 'success'
  // 경고 상태
  if (lower.includes('대기') || lower.includes('진행') || lower.includes('예약')) return 'warning'
  // 실패/취소 상태
  if (lower.includes('취소') || lower.includes('실패') || lower.includes('거부')) return 'destructive'
  // 정보 상태
  if (lower.includes('상담') || lower.includes('문의')) return 'info'
  return 'secondary'
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={getStatusVariant(status)} className={className}>
      {status}
    </Badge>
  )
}
