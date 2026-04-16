'use client'

import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/components/charts'

import { ChartTooltipProps } from '@/types/recharts'
import { CHART_PALETTE } from '@/lib/chart-colors'

interface Props {
  trend: Array<Record<string, string | number>>
  pageNames: string[]
}

function TrendTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          <span style={{ color: p.color }}>●</span>{' '}
          {p.name}: <span className="text-foreground font-medium">{p.value}건</span>
        </p>
      ))}
    </div>
  )
}

export default function LandingPageTrendChart({ trend, pageNames }: Props) {
  if (trend.length === 0 || pageNames.length === 0) return null

  const xInterval = trend.length >= 28 ? 6 : trend.length >= 14 ? 3 : 0

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">랜딩페이지 리드 추이</h2>
        <span className="text-xs text-muted-foreground">상위 {pageNames.length}개 · 일별</span>
      </div>

      <div className="hidden md:block">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={xInterval}
              tickFormatter={(v: string) => {
                const parts = v.split('-')
                return `${Number(parts[1])}/${Number(parts[2])}`
              }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<TrendTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: 11,
                color: 'hsl(var(--muted-foreground))',
                paddingBottom: 8,
              }}
            />
            {pageNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                name={name}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="block md:hidden">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={xInterval}
              tickFormatter={(v: string) => {
                const parts = v.split('-')
                return `${Number(parts[1])}/${Number(parts[2])}`
              }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<TrendTooltip />} />
            {pageNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                name={name}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
