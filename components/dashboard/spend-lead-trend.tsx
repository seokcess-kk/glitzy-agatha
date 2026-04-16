'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from '@/components/charts'
import { TrendingUp } from 'lucide-react'
import { ChartTooltipProps } from '@/types/recharts'
import { CHART_SEMANTIC } from '@/lib/chart-colors'

const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

interface TrendDataItem {
  date: string
  spend: number
  leads: number
}

interface SpendLeadTrendProps {
  data?: TrendDataItem[]
  loading?: boolean
  periodLabel?: string
}

function DualTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          {p.name}:{' '}
          <span className="text-foreground font-medium">
            {p.dataKey === 'spend' ? fmtKrw(p.value) : `${p.value}건`}
          </span>
        </p>
      ))}
    </div>
  )
}

function DualChart({ data, height, fontSize, dotRadius, gradientId, showLegend }: {
  data: TrendDataItem[]
  height: number
  fontSize: number
  dotRadius: number
  gradientId: string
  showLegend?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_SEMANTIC.brand} stopOpacity={0.2} />
            <stop offset="100%" stopColor={CHART_SEMANTIC.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => {
            const parts = v.split('-')
            return `${Number(parts[1])}/${Number(parts[2])}`
          }}
          interval={6}
        />
        <YAxis yAxisId="spend" tickFormatter={fmtKrw} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="leads" orientation="right" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }} axisLine={false} tickLine={false} unit="건" />
        <Tooltip content={<DualTooltip />} />
        {showLegend && (
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', paddingBottom: 8 }}
          />
        )}
        <Area yAxisId="spend" type="monotone" dataKey="spend" name="광고비" stroke={CHART_SEMANTIC.brand} fill={`url(#${gradientId})`} strokeWidth={2} />
        <Line yAxisId="leads" type="monotone" dataKey="leads" name="리드 수" stroke={CHART_SEMANTIC.lead} strokeWidth={2} dot={dotRadius > 0 ? { r: dotRadius, fill: CHART_SEMANTIC.lead } : false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function SpendLeadTrend({ data, loading, periodLabel }: SpendLeadTrendProps) {
  const label = periodLabel || (data ? `${data.length}일` : '')
  return (
    <Card variant="glass" className="p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">광고비 · 리드 추이</h2>
          {/* 모바일 인라인 범례 */}
          <div className="flex items-center gap-3 mt-1 md:hidden">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_SEMANTIC.brand }} />
              광고비
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_SEMANTIC.lead }} />
              리드 수
            </span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{label} (일별)</span>
      </div>
      {loading ? (
        <Skeleton className="h-[240px] md:h-[300px] rounded-lg" />
      ) : data && data.length > 0 ? (
        <>
          <div className="hidden md:block">
            <DualChart data={data} height={300} fontSize={11} dotRadius={3} gradientId="spendGradDual" showLegend />
          </div>
          <div className="block md:hidden">
            <DualChart data={data} height={200} fontSize={10} dotRadius={0} gradientId="spendGradDualMobile" />
          </div>
        </>
      ) : (
        <div className="h-[240px] md:h-[300px] flex flex-col gap-2 items-center justify-center text-muted-foreground text-sm">
          <TrendingUp size={28} className="text-muted-foreground/50 mb-1" />
          <span>진행 중인 광고 캠페인이 없습니다.</span>
        </div>
      )}
    </Card>
  )
}
