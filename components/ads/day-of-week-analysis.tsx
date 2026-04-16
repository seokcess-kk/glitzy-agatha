'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClient } from '@/components/ClientContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from '@/components/charts'
import { CalendarDays } from 'lucide-react'
import { ChartTooltipProps, ChartLabelProps } from '@/types/recharts'
import { BAR_COLORS } from '@/lib/chart-colors'

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

interface DayData {
  day: number
  dayLabel: string
  leads: number
  spend: number
  cpl: number
}

interface DayAnalysisResponse {
  byDay: DayData[]
}

interface Props {
  startDate: string
  endDate: string
}

function DayTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as unknown as DayData | undefined
  if (!d) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1.5">{label}</p>
      <p className="text-muted-foreground">
        리드 수: <span className="text-foreground font-medium">{d.leads}건</span>
      </p>
      <p className="text-muted-foreground">
        광고비: <span className="text-foreground font-medium">₩{d.spend.toLocaleString()}</span>
      </p>
      <p className="text-muted-foreground">
        CPL: <span className="text-foreground font-medium">₩{Math.round(d.cpl).toLocaleString()}</span>
      </p>
    </div>
  )
}

// Custom label rendered above each bar showing CPL (from payload, not bar value)
function CplLabel(props: ChartLabelProps) {
  const { x = 0, y = 0, width = 0 } = props
  const cpl = Number(props?.payload?.cpl) || 0
  if (!cpl || cpl === 0) return null
  const displayVal = cpl >= 10000
    ? `₩${(cpl / 10000).toFixed(0)}만`
    : `₩${Math.round(cpl).toLocaleString()}`
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fill="hsl(var(--muted-foreground))"
      fontSize={9}
    >
      {displayVal}
    </text>
  )
}

export default function DayOfWeekAnalysis({ startDate, endDate }: Props) {
  const { selectedClientId } = useClient()
  const [data, setData] = useState<DayAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))

      const res = await fetch(`/api/ads/day-analysis?${qs}`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const byDay = useMemo(() => data?.byDay || [], [data])

  const maxLeads = useMemo(
    () => Math.max(...byDay.map((d) => d.leads), 0),
    [byDay]
  )

  // Attach a fill color to each bar entry
  const chartData = useMemo(
    () =>
      byDay.map((d) => ({
        ...d,
        fill: d.leads === maxLeads && maxLeads > 0 ? BAR_COLORS.max : BAR_COLORS.default,
      })),
    [byDay, maxLeads]
  )

  return (
    <Card variant="glass" className="p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">요일별 리드 분석</h2>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {loading ? (
        <Skeleton className="h-[200px] rounded-lg flex-1" />
      ) : byDay.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="요일별 분석 데이터가 없습니다"
          description="광고 데이터가 동기화되면 요일별 리드 패턴을 확인할 수 있습니다."
        />
      ) : (
        <div className="flex-1 min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 18, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="dayLabel"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DayTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
              <Bar
                dataKey="leads"
                name="리드 수"
                radius={[4, 4, 0, 0]}
                fill={BAR_COLORS.default}
                isAnimationActive={false}
                label={<CplLabel />}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
