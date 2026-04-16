'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, StatsCard } from '@/components/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { FileText } from 'lucide-react'
import { ChartTooltipProps } from '@/types/recharts'
import { BAR_COLORS } from '@/lib/chart-colors'
import LandingPageTrendChart from './landing-page-trend-chart'
import LandingPageChannelBreakdown from './landing-page-channel-breakdown'

interface LandingPageRow {
  landingPageId: number
  name: string
  isActive: boolean
  leads: number
  bookings: number
  customers: number
  revenue: number
  leadToBookingRate: number
  conversionRate: number
}

interface ChannelData {
  channel: string
  leads: number
}

interface PageChannelBreakdown {
  landingPageId: number
  name: string
  channels: ChannelData[]
}

interface AnalysisData {
  pages: LandingPageRow[]
  trend: Array<Record<string, string | number>>
  trendLabels: string[]
  channelBreakdown: PageChannelBreakdown[]
}

interface Props {
  startDate: string
  endDate: string
  /** delivery: 광고 지표만 (캠페인 분석 탭), full: 전환 포함 (매출 귀속 탭) */
  mode?: 'delivery' | 'full'
}

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

function BarTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as { name: string; leads: number } | undefined
  if (!d) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1.5">{d.name}</p>
      <p className="text-muted-foreground">
        리드: <span className="text-foreground font-medium">{d.leads}건</span>
      </p>
    </div>
  )
}

export default function LandingPageAnalysis({ startDate, endDate, mode = 'delivery' }: Props) {
  const { selectedClinicId } = useClinic()
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/landing-page-analysis?${qs}`)
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
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const pages = useMemo(() => data?.pages || [], [data])
  const trend = useMemo(() => data?.trend || [], [data])
  const channelBreakdown = useMemo(() => data?.channelBreakdown || [], [data])
  const trendLabels = useMemo(() => data?.trendLabels || [], [data])

  const barData = useMemo(() => {
    if (pages.length === 0) return []
    const top5 = pages.slice(0, 5)
    const rest = pages.slice(5)
    const result = top5.map(p => ({ name: p.name, leads: p.leads }))
    if (rest.length > 0) {
      const otherLeads = rest.reduce((sum, p) => sum + p.leads, 0)
      if (otherLeads > 0) {
        result.push({ name: '기타', leads: otherLeads })
      }
    }
    return result
  }, [pages])

  const maxLeads = useMemo(
    () => Math.max(...barData.map(d => d.leads), 0),
    [barData]
  )

  const hasChannelData = channelBreakdown.length > 0
  const showFull = mode === 'full'

  const thClass = 'text-[11px] text-muted-foreground font-medium whitespace-nowrap'

  if (loading) {
    return (
      <Card variant="glass" className="p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-[200px] rounded-lg" />
      </Card>
    )
  }

  if (pages.length === 0) {
    return (
      <Card variant="glass" className="p-5">
        <EmptyState
          icon={FileText}
          title="랜딩페이지 데이터가 없습니다"
          description="랜딩페이지가 등록되면 성과를 확인할 수 있습니다."
        />
      </Card>
    )
  }

  // LP 1개일 때 퍼포먼스 카드
  if (pages.length === 1 && mode === 'delivery') {
    const lp = pages[0]
    const channelCount = channelBreakdown[0]?.channels?.length ?? 0

    return (
      <>
        <Card variant="glass" className="p-5">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground shrink-0">랜딩페이지 성과</h2>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                lp.isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {lp.isActive ? '활성' : '비활성'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
          </div>
          <p className="text-sm text-foreground/80 mb-4 truncate" title={lp.name}>{lp.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <StatsCard label="리드" value={`${lp.leads}건`} />
            <StatsCard label="유입 채널" value={channelCount > 0 ? `${channelCount}개` : '-'} />
          </div>
        </Card>

        {/* 추이 차트 */}
        {trend.length > 0 && trendLabels.length > 0 && (
          <div className="mt-6 lg:col-span-2">
            <LandingPageTrendChart trend={trend} pageNames={trendLabels} />
          </div>
        )}

        {/* 채널 분석 */}
        {hasChannelData && (
          <div className="mt-6 lg:col-span-2">
            <LandingPageChannelBreakdown channelBreakdown={channelBreakdown} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* 바차트: 리드 비교 */}
      <Card variant="glass" className="p-5">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="font-semibold text-foreground shrink-0">랜딩페이지별 리드</h2>
          <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
            <Bar
              dataKey="leads"
              name="리드 수"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              {barData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.leads === maxLeads && maxLeads > 0 ? BAR_COLORS.max : BAR_COLORS.default}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 추이 차트 (전체 폭) */}
      {trend.length > 0 && trendLabels.length > 0 && (
        <div className="mt-6 lg:col-span-2">
          <LandingPageTrendChart trend={trend} pageNames={trendLabels} />
        </div>
      )}

      {/* 채널 분석 (전체 폭, UTM 데이터 있을 때만) */}
      {hasChannelData && (
        <div className="mt-6 lg:col-span-2">
          <LandingPageChannelBreakdown channelBreakdown={channelBreakdown} />
        </div>
      )}

      {/* 상세 테이블 (전체 폭) */}
      <Card variant="glass" className="mt-6 p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="font-semibold text-foreground shrink-0">랜딩페이지 성과 상세</h2>
          <span className="text-xs text-muted-foreground">{pages.length}개 페이지</span>
        </div>

        <div className="overflow-x-auto">
          <Table className={showFull ? 'min-w-[640px]' : 'min-w-[400px]'}>
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className={thClass}>페이지명</TableHead>
                <TableHead className={`${thClass} text-center`}>상태</TableHead>
                <TableHead className={`${thClass} text-right`}>리드</TableHead>
                {showFull && (
                  <>
                    <TableHead className={`${thClass} text-right`}>예약고객</TableHead>
                    <TableHead className={`${thClass} text-right`}>예약전환율</TableHead>
                    <TableHead className={`${thClass} text-right`}>결제고객</TableHead>
                    <TableHead className={`${thClass} text-right`}>전환율</TableHead>
                    <TableHead className={`${thClass} text-right`}>매출</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((row, idx) => (
                <TableRow
                  key={row.landingPageId}
                  className={`border-b border-border/50 dark:border-white/[0.03] ${
                    idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''
                  }`}
                >
                  <TableCell className="py-2.5 max-w-[160px]">
                    <span className="text-sm text-foreground/90 truncate block" title={row.name}>
                      {row.name}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      row.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {row.isActive ? '활성' : '비활성'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.leads.toLocaleString()}
                  </TableCell>
                  {showFull && (
                    <>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.bookings > 0 ? row.bookings.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm font-medium">
                        <span className={row.leadToBookingRate >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'}>
                          {row.leadToBookingRate > 0 ? `${row.leadToBookingRate.toFixed(1)}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.customers.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm font-medium">
                        <span className={row.conversionRate >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'}>
                          {row.conversionRate > 0 ? `${row.conversionRate.toFixed(1)}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.revenue > 0 ? `₩${row.revenue.toLocaleString()}` : '-'}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  )
}
