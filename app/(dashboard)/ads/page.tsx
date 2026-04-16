'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { startOfDay, startOfMonth } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { RefreshCw, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useClient } from '@/components/ClientContext'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { getKstDateString } from '@/lib/date'
import AdsOverviewTab from '@/components/ads/ads-overview-tab'
import AdsCampaignTab from '@/components/ads/ads-campaign-tab'

const TABS = [
  { key: 'overview', label: '성과 개요' },
  { key: 'campaigns', label: '캠페인 분석' },
]

export default function AdsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  // Role guard — client_staff cannot access ads
  useEffect(() => {
    if (user?.role === 'client_staff') router.replace('/patients')
  }, [user, router])

  const { selectedClientId } = useClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = startOfDay(new Date())
    return { from: startOfMonth(today), to: today }
  })
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // KST 기준 YYYY-MM-DD 문자열 (ad_campaign_stats.stat_date와 동일 형식)
  const startDate = dateRange.from ? getKstDateString(dateRange.from) : getKstDateString(startOfMonth(new Date()))
  const endDate = dateRange.to ? getKstDateString(dateRange.to) : getKstDateString(new Date())

  // 기간 일수 계산 (표시용 + 캠페인 탭 stats API용)
  const daysDiff = dateRange.from && dateRange.to
    ? Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1)
    : 30

  // Restore tab from URL on mount (avoids hydration mismatch)
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'campaigns') setActiveTab(tab)
  }, [])

  // Sync tab selection to URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'overview') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    window.history.replaceState({}, '', url.toString())
  }

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ads/sync', { method: 'POST' })
      const data = await res.json()
      toast.success(
        `데이터 수집 완료 (Meta: ${data.results?.meta ?? 0}, Google: ${data.results?.google ?? 0}, TikTok: ${data.results?.tiktok ?? 0})`
      )
      handleRefresh()
    } catch {
      toast.error('동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  const showActions = activeTab === 'overview' || activeTab === 'campaigns'

  return (
    <>
      <PageHeader
        title="광고 성과"
        description="Meta / Google / TikTok 광고 지출 및 성과 데이터."
        actions={
          showActions ? (
            <>
              <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw size={16} />
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-brand-600 hover:bg-brand-700"
              >
                <Play size={14} /> {syncing ? '수집 중...' : '지금 데이터 수집'}
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border dark:border-white/5 pb-px">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <AdsOverviewTab key={`overview-${startDate}-${endDate}-${refreshKey}`} startDate={startDate} endDate={endDate} />
      )}
      {activeTab === 'campaigns' && (
        <AdsCampaignTab key={`campaigns-${startDate}-${endDate}-${refreshKey}`} startDate={startDate} endDate={endDate} days={String(daysDiff)} />
      )}
    </>
  )
}
