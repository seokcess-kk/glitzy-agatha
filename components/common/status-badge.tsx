import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

/** 리드 상태 코드별 배지 스타일 */
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new:          { bg: 'bg-violet-50',  text: 'text-violet-700',  label: '신규' },
  in_progress:  { bg: 'bg-amber-50',   text: 'text-amber-700',   label: '진행중' },
  converted:    { bg: 'bg-emerald-50',  text: 'text-emerald-700', label: '전환' },
  hold:         { bg: 'bg-slate-100',   text: 'text-slate-600',   label: '보류' },
  lost:         { bg: 'bg-rose-50',     text: 'text-rose-700',    label: '미전환' },
  invalid:      { bg: 'bg-slate-50',    text: 'text-slate-400',   label: '무효' },
}

/** 텍스트 기반 fallback (기존 호환) */
function getFallbackStyle(status: string): { bg: string; text: string; label: string } {
  const lower = status?.toLowerCase() || ''
  if (lower.includes('완료') || lower.includes('성공') || lower.includes('결제') || lower.includes('확정'))
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: status }
  if (lower.includes('대기') || lower.includes('진행') || lower.includes('예약'))
    return { bg: 'bg-amber-50', text: 'text-amber-700', label: status }
  if (lower.includes('취소') || lower.includes('실패') || lower.includes('거부'))
    return { bg: 'bg-rose-50', text: 'text-rose-700', label: status }
  if (lower.includes('상담') || lower.includes('문의'))
    return { bg: 'bg-violet-50', text: 'text-violet-700', label: status }
  return { bg: 'bg-slate-100', text: 'text-slate-600', label: status }
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || getFallbackStyle(status)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        style.bg,
        style.text,
        className,
      )}
      style={{ borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: 500 }}
    >
      {style.label}
    </span>
  )
}
