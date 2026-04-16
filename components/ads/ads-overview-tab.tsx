'use client'

import AdsKpiCards from '@/components/ads/ads-kpi-cards'
import AdsFunnel from '@/components/ads/ads-funnel'
import EfficiencyTrendChart from '@/components/ads/efficiency-trend-chart'
import PlatformComparisonTable from '@/components/ads/platform-comparison-table'
import DayOfWeekAnalysis from '@/components/ads/day-of-week-analysis'

interface Props {
  startDate: string
  endDate: string
}

export default function AdsOverviewTab({ startDate, endDate }: Props) {
  return (
    <>
      <AdsKpiCards startDate={startDate} endDate={endDate} />
      <div className="mb-6" />
      <EfficiencyTrendChart startDate={startDate} endDate={endDate} />
      <div className="mb-6" />
      <PlatformComparisonTable startDate={startDate} endDate={endDate} />
      <div className="mb-6" />
      <div className="grid lg:grid-cols-2 gap-3">
        <AdsFunnel startDate={startDate} endDate={endDate} />
        <DayOfWeekAnalysis startDate={startDate} endDate={endDate} />
      </div>
    </>
  )
}
