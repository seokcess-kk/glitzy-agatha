import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  loading?: boolean
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  onClick?: () => void
  subtitle?: string
  subtitleColor?: 'default' | 'positive' | 'negative'
  size?: 'default' | 'lg'
}

function getValueSizeClass(value: string | number, isLg: boolean): string {
  const len = String(value).length
  if (isLg) {
    if (len <= 6) return 'text-2xl md:text-3xl'
    if (len <= 9) return 'text-xl md:text-2xl'
    if (len <= 12) return 'text-lg md:text-xl'
    return 'text-base md:text-lg'
  }
  if (len <= 6) return 'text-xl md:text-2xl'
  if (len <= 9) return 'text-lg md:text-xl'
  if (len <= 12) return 'text-base md:text-lg'
  return 'text-sm md:text-base'
}

export function StatsCard({ label, value, loading, icon: Icon, trend, onClick, subtitle, subtitleColor = 'default', size = 'default' }: StatsCardProps) {
  const isLg = size === 'lg'
  const clickable = !!onClick

  return (
    <Card
      variant="glass"
      className={`${isLg ? 'p-5 md:p-6' : 'p-4 md:p-5'} h-full animate-fade-in-up overflow-hidden ${
        clickable ? 'cursor-pointer hover:border-border dark:hover:border-white/20 hover:bg-muted/30 dark:hover:bg-white/[0.03] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : ''
      }`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      aria-label={clickable ? `${label}: ${value}` : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium truncate">
          {label}
        </p>
        {Icon && <Icon size={isLg ? 16 : 14} className="text-muted-foreground/70 shrink-0" />}
      </div>
      {loading ? (
        <Skeleton className={`${isLg ? 'h-9 md:h-10' : 'h-7 md:h-8'} mb-2`} />
      ) : (
        <p className={`${getValueSizeClass(value, isLg)} font-bold text-foreground mb-1 tabular-nums break-all`}>
          {value}
        </p>
      )}
      {subtitle && !loading && (
        <p className={`text-xs truncate ${
          subtitleColor === 'positive' ? 'text-emerald-500 dark:text-emerald-400' :
          subtitleColor === 'negative' ? 'text-rose-500 dark:text-rose-400' :
          'text-muted-foreground'
        }`}>{subtitle}</p>
      )}
      {trend && !loading && (
        <div className={`inline-flex items-center gap-1 text-xs font-medium mt-1 px-1.5 py-0.5 rounded ${
          trend.isPositive
            ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400'
            : 'text-rose-600 bg-rose-500/10 dark:text-rose-400'
        }`}>
          {trend.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          <span className="tabular-nums">{Math.abs(trend.value)}%</span>
        </div>
      )}
    </Card>
  )
}
