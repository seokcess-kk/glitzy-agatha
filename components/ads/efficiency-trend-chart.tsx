'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/components/charts'
import { TrendingUp } from 'lucide-react'
import { ChartTooltipProps } from '@/types/recharts'
import { CHART_SEMANTIC } from '@/lib/chart-colors'

interface EfficiencyDataItem {
  date: string
  spend: number
  clicks: number
  impressions: number
  leads: number
  cpl: number
  cpc: number
  ctr: number
}

interface Props {
  startDate: string
  endDate: string
}

function fmtKrw(v: number) {
  return `₩${Math.round(v).toLocaleString()}`
}

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`
}

function EfficiencyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const cpl = payload.find((p) => p.dataKey === 'cpl')
  const cpc = payload.find((p) => p.dataKey === 'cpc')
  const ctr = payload.find((p) => p.dataKey === 'ctr')
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1.5">{label}</p>
      {cpl && (
        <p className="text-muted-foreground">
          CPL:{' '}
          <span className="text-foreground font-medium">{fmtKrw(cpl.value)}</span>
        </p>
      )}
      {cpc && (
        <p className="text-muted-foreground">
          CPC:{' '}
          <span className="text-foreground font-medium">{fmtKrw(cpc.value)}</span>
        </p>
      )}
      {ctr && (
        <p className="text-muted-foreground">
          CTR:{' '}
          <span className="text-foreground font-medium">{fmtPct(ctr.value)}</span>
        </p>
      )}
    </div>
  )
}

function EfficiencyChart({
  data,
  height,
  fontSize,
  gradientId,
  showLegend,
  xInterval,
}: {
  data: EfficiencyDataItem[]
  height: number
  fontSize: number
  gradientId: string
  showLegend?: boolean
  xInterval: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_SEMANTIC.cpl} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_SEMANTIC.cpl} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
          axisLine={false}
          tickLine={false}
          interval={xInterval}
          tickFormatter={(v: string) => {
            const parts = v.split('-')
            return `${Number(parts[1])}/${Number(parts[2])}`
          }}
        />
        {/* Left Y-axis: ₩ amount */}
        <YAxis
          yAxisId="krw"
          tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
          axisLine={false}
          tickLine={false}
        />
        {/* Right Y-axis: % ratio */}
        <YAxis
          yAxisId="pct"
          orientation="right"
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<EfficiencyTooltip />} />
        {showLegend && (
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
        )}
        <Area
          yAxisId="krw"
          type="monotone"
          dataKey="cpl"
          name="CPL"
          stroke={CHART_SEMANTIC.cpl}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
        />
        <Line
          yAxisId="krw"
          type="monotone"
          dataKey="cpc"
          name="CPC"
          stroke={CHART_SEMANTIC.cpc}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="ctr"
          name="CTR"
          stroke={CHART_SEMANTIC.ctr}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function EfficiencyTrendChart({ startDate, endDate }: Props) {
  const { selectedClinicId } = useClinic()
  const [data, setData] = useState<EfficiencyDataItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/efficiency-trend?${qs}`)
      if (!res.ok) {
        setData([])
        return
      }
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const xInterval = data.length >= 28 ? 6 : 0

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">효율 추이</h2>
        <span className="text-xs text-muted-foreground">일별</span>
      </div>

      {loading ? (
        <Skeleton className="h-[200px] md:h-[280px] rounded-lg" />
      ) : data.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="효율 추이 데이터가 없습니다"
          description="광고 데이터가 동기화되면 CPL·CPC·CTR 추이를 확인할 수 있습니다."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <EfficiencyChart
              data={data}
              height={280}
              fontSize={11}
              gradientId="effGradDesktop"
              showLegend
              xInterval={xInterval}
            />
          </div>
          <div className="block md:hidden">
            <EfficiencyChart
              data={data}
              height={200}
              fontSize={10}
              gradientId="effGradMobile"
              xInterval={xInterval}
            />
          </div>
        </>
      )}
    </Card>
  )
}
