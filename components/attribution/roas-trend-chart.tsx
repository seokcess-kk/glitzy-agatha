'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
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
import { TrendingUp } from 'lucide-react'
import { getChannelColor } from '@/lib/channel-colors'
import { ChartTooltipProps } from '@/types/recharts'

interface DayChannelEntry {
  date: string
  channels: Record<string, { spend: number; revenue: number; roas: number }>
}

interface Props {
  startDate: string
  endDate: string
}

function RoasTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          <span style={{ color: p.color }}>{p.name}</span>:{' '}
          <span className="text-foreground font-medium">{(Number(p.value) * 100).toFixed(0)}%</span>
        </p>
      ))}
    </div>
  )
}

export default function RoasTrendChart({ startDate, endDate }: Props) {
  const { selectedClinicId } = useClinic()
  const [rawData, setRawData] = useState<DayChannelEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/attribution/roas-trend?${qs}`)
      if (!res.ok) {
        setRawData([])
        return
      }
      const json = await res.json()
      setRawData(Array.isArray(json) ? json : [])
    } catch {
      setRawData([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => { fetchData() }, [fetchData])

  // 모든 채널 수집 + 상위 5개
  const channels = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const day of rawData) {
      for (const [ch, data] of Object.entries(day.channels)) {
        totals[ch] = (totals[ch] || 0) + data.revenue
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ch]) => ch)
  }, [rawData])

  // 차트 데이터 변환
  const chartData = useMemo(() => {
    return rawData.map(day => {
      const entry: Record<string, string | number> = {
        date: day.date.slice(5), // MM-DD
      }
      for (const ch of channels) {
        entry[ch] = day.channels[ch]?.roas ?? 0
      }
      return entry
    })
  }, [rawData, channels])

  const hasData = chartData.some(d => channels.some(ch => Number(d[ch]) > 0))
  const xInterval = chartData.length >= 28 ? 6 : chartData.length >= 14 ? 3 : 0

  return (
    <Card variant="glass" className="p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">ROAS 추이</h3>

      {loading ? (
        <Skeleton className="h-[240px] rounded-lg" />
      ) : !hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="ROAS 추이 데이터 없음"
          description="광고비와 매출 데이터가 쌓이면 표시됩니다."
        />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={xInterval}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<RoasTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', paddingBottom: 8 }}
            />
            {channels.map(ch => (
              <Line
                key={ch}
                type="monotone"
                dataKey={ch}
                name={ch}
                stroke={getChannelColor(ch)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
