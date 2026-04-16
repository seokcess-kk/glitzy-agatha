'use client'

import { StatsCard } from '@/components/common'

interface KpiData {
  totalLeads?: number
  totalRevenue?: number
  totalSpend?: number
  cpl?: number
  roas?: number
  today?: {
    leads: number
  }
  comparison?: {
    totalLeads?: number
    totalRevenue?: number
    totalSpend?: number
    cpl?: number
    roas?: number
  }
}

type SubtitleColor = 'default' | 'positive' | 'negative'

interface KpiCard {
  label: string
  value: string
  trend?: { value: number; isPositive: boolean }
  subtitle?: string
  subtitleColor: SubtitleColor
  path: string
}

interface KpiSectionProps {
  data?: KpiData | null
  loading?: boolean
  onNavigate?: (path: string) => void
}

export function KpiSection({ data, loading, onNavigate }: KpiSectionProps) {
  const totalLeads = data?.totalLeads ?? 0
  const totalSpend = data?.totalSpend ?? 0
  const cpl = data?.cpl ?? 0
  const todayLeads = data?.today?.leads ?? 0

  const cards: KpiCard[] = data ? [
    {
      label: '광고비',
      value: `₩${totalSpend.toLocaleString()}`,
      trend: data.comparison?.totalSpend !== undefined && data.comparison.totalSpend !== 0
        ? { value: Math.abs(data.comparison.totalSpend), isPositive: data.comparison.totalSpend < 0 }
        : undefined,
      subtitleColor: 'default',
      path: '/ads',
    },
    {
      label: '리드',
      value: `${totalLeads.toLocaleString()}건`,
      trend: data.comparison?.totalLeads !== undefined && data.comparison.totalLeads !== 0
        ? { value: Math.abs(data.comparison.totalLeads), isPositive: data.comparison.totalLeads > 0 }
        : undefined,
      subtitle: `오늘 +${todayLeads}`,
      subtitleColor: todayLeads > 0 ? 'positive' : 'default',
      path: '/customers',
    },
    {
      label: 'CPL',
      value: cpl > 0 ? `₩${cpl.toLocaleString()}` : '-',
      trend: data.comparison?.cpl !== undefined && data.comparison.cpl !== 0
        ? { value: Math.abs(data.comparison.cpl), isPositive: data.comparison.cpl < 0 }
        : undefined,
      subtitleColor: 'default',
      path: '/ads',
    },
    {
      label: '매출',
      value: `₩${(data.totalRevenue ?? 0).toLocaleString()}`,
      trend: data.comparison?.totalRevenue !== undefined && data.comparison.totalRevenue !== 0
        ? { value: Math.abs(data.comparison.totalRevenue), isPositive: data.comparison.totalRevenue > 0 }
        : undefined,
      subtitleColor: 'default',
      path: '/customers',
    },
    {
      label: 'ROAS',
      value: `${((data.roas ?? 0) * 100).toFixed(0)}%`,
      trend: data.comparison?.roas !== undefined && data.comparison.roas !== 0
        ? { value: Math.abs(data.comparison.roas), isPositive: data.comparison.roas > 0 }
        : undefined,
      subtitleColor: 'default',
      path: '/attribution',
    },
  ] : ['광고비', '리드', 'CPL', '매출', 'ROAS'].map(label => ({
    label,
    value: '-',
    subtitleColor: 'default' as SubtitleColor,
    path: '/',
  }))

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 md:mb-8">
      {cards.map((card, i) => (
        <div key={card.label} className={i === cards.length - 1 ? 'col-span-2 md:col-span-1' : ''}>
          <StatsCard
            label={card.label}
            value={card.value}
            loading={loading}
            trend={card.trend}
            subtitle={card.subtitle}
            subtitleColor={card.subtitleColor}
            onClick={onNavigate ? () => onNavigate(card.path) : undefined}
          />
        </div>
      ))}
    </div>
  )
}
