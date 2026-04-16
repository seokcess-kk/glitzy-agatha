'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { startOfMonth, startOfDay } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common'
import { useClient } from '@/components/ClientContext'
import { useKpiData, useTrendData, useFunnelChannelData, useRecentLeads } from '@/hooks/use-dashboard-data'
import { getKstDayStartISO, getKstDayEndISO } from '@/lib/date'

// 섹션 컴포넌트
import { KpiSection } from '@/components/dashboard/kpi-section'
import { SpendLeadTrend } from '@/components/dashboard/spend-lead-trend'
import { FunnelSection } from '@/components/dashboard/funnel-section'
import { RecentLeads } from '@/components/dashboard/recent-leads'
import { ChannelTable } from '@/components/dashboard/channel-table'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const sessionUser = session?.user
  const { selectedClientId } = useClient()

  useEffect(() => {
    if (sessionUser?.role === 'client_staff') router.replace('/patients')
  }, [sessionUser, router])

  // 기본값: 이번 달
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = startOfDay(new Date())
    return { from: startOfMonth(today), to: today }
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const startDate = dateRange.from ? getKstDayStartISO(dateRange.from) : getKstDayStartISO(new Date())
  const endDate = dateRange.to ? getKstDayEndISO(dateRange.to) : getKstDayEndISO(new Date())

  // 섹션별 독립 데이터 페칭
  const kpi = useKpiData(selectedClientId, startDate, endDate)
  const trendData = useTrendData(selectedClientId, startDate, endDate)
  const funnelChannel = useFunnelChannelData(selectedClientId, startDate, endDate)
  const recentLeadsData = useRecentLeads(selectedClientId)

  // 마지막 업데이트 시간 추적
  useEffect(() => {
    if (!kpi.loading) setLastUpdated(new Date())
  }, [kpi.loading])

  const handleRefresh = () => {
    kpi.refetch()
    trendData.refetch()
    funnelChannel.refetch()
    recentLeadsData.refetch()
  }

  const anyLoading = kpi.loading || trendData.loading || funnelChannel.loading
  const handleNavigate = (path: string) => router.push(path)

  // 기간 일수 계산 (표시용)
  const daysDiff = dateRange.from && dateRange.to
    ? Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 1

  // 추이 그래프 기간 라벨 (최소 4주 보장)
  const trendDays = Math.max(daysDiff, 28)
  const daysLabel = daysDiff === 1 ? '당일' : `${daysDiff}일`
  const trendPeriodLabel = trendDays === daysDiff
    ? `최근 ${daysDiff}일`
    : daysDiff <= 1
      ? '최근 4주'
      : `최근 4주 (선택: ${daysLabel})`

  return (
    <>
      {/* Header */}
      <PageHeader
        title="마케팅 성과 대시보드"
        description={lastUpdated ? `마지막 업데이트: ${lastUpdated.toLocaleTimeString('ko', { timeZone: 'Asia/Seoul' })}` : '데이터 로딩 중...'}
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={anyLoading} className="text-muted-foreground hover:text-foreground">
              <RefreshCw size={16} className={anyLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        }
      />

      {/* Row 1: KPI 카드 5개 */}
      <KpiSection data={kpi.data} loading={kpi.loading} onNavigate={handleNavigate} />

      {/* Row 2: 광고비·리드 추이 */}
      <div className="mb-6 md:mb-8">
        <SpendLeadTrend data={trendData.trend} loading={trendData.loading} periodLabel={trendPeriodLabel} />
      </div>

      {/* Row 3: 전환 퍼널 + 최근 리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6 md:mb-8">
        <FunnelSection data={funnelChannel.funnel} loading={funnelChannel.loading} />
        <RecentLeads data={recentLeadsData.recentLeads} loading={recentLeadsData.loading} />
      </div>

      {/* Row 4: 채널 성과 테이블 */}
      <div className="mb-6 md:mb-8">
        <ChannelTable data={funnelChannel.channel} loading={funnelChannel.loading} />
      </div>
    </>
  )
}
