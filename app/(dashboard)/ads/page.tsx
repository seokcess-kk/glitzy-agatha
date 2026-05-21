'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { startOfDay, startOfMonth } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { RefreshCw, Play, History, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useClient } from '@/components/ClientContext'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { getKstDateString } from '@/lib/date'
import AdsOverviewTab from '@/components/ads/ads-overview-tab'
import AdsCampaignTab from '@/components/ads/ads-campaign-tab'
import BackfillDialog from '@/components/ads/backfill-dialog'
import ManualInflowDialog from '@/components/ads/ManualInflowDialog'

const TABS = [
  { key: 'overview', label: '성과 개요' },
  { key: 'campaigns', label: '캠페인 분석' },
]

// useSearchParams 사용 컴포넌트는 prerender 시 Suspense boundary 필요. 외부 default export 가 감싸준다.
export default function AdsPage() {
  return (
    <Suspense fallback={null}>
      <AdsPageInner />
    </Suspense>
  )
}

function AdsPageInner() {
  const { data: session } = useSession()
  const user = session?.user
  const canSync = user?.role !== 'client_staff'
  const isSuperAdmin = user?.role === 'superadmin'

  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedClientId, clients } = useClient()
  const selectedClient = clients.find(c => c.id === selectedClientId)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = startOfDay(new Date())
    return { from: startOfMonth(today), to: today }
  })
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [manualInflowOpen, setManualInflowOpen] = useState(false)
  const [configuredPlatforms, setConfiguredPlatforms] = useState<string[]>([])
  // 캠페인 분석 탭의 매체 필터 — 인입 보정 가드와 동기화하기 위해 lift up
  const [campaignPlatformFilter, setCampaignPlatformFilter] = useState('all')
  const hasAdnAds = configuredPlatforms.includes('adn_ads')
  // 캠페인 분석 탭에서는 매체 필터가 ADN 또는 '전체 매체'일 때만 인입 보정 버튼 노출.
  // 성과 개요 탭은 매체 필터가 없으니 항상 노출.
  const matchesAdnForManualInflow =
    activeTab !== 'campaigns' ||
    campaignPlatformFilter === 'all' ||
    campaignPlatformFilter === 'adn_ads'
  const canEditManualInflow =
    (user?.role === 'superadmin' || user?.role === 'client_admin') &&
    hasAdnAds &&
    matchesAdnForManualInflow

  // KST 기준 YYYY-MM-DD 문자열 (ad_campaign_stats.stat_date와 동일 형식)
  const startDate = dateRange.from ? getKstDateString(dateRange.from) : getKstDateString(startOfMonth(new Date()))
  const endDate = dateRange.to ? getKstDateString(dateRange.to) : getKstDateString(new Date())

  // 기간 일수 계산 (표시용 + 캠페인 탭 stats API용)
  const daysDiff = dateRange.from && dateRange.to
    ? Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1)
    : 30

  // URL → state 동기화. 사이드바 deep link(/ads?tab=campaigns) 클릭이 mount 가 아니라
  // 같은 페이지의 query 변경만 일으키는 경우에도 탭이 따라가도록 searchParams 의존성으로 처리.
  useEffect(() => {
    const tab = searchParams?.get('tab') ?? 'overview'
    setActiveTab(tab === 'campaigns' ? 'campaigns' : 'overview')
  }, [searchParams])

  // 현재 클라이언트의 활성 연동 매체 목록 로딩 (수동 인입 보정 가드용)
  useEffect(() => {
    if (!selectedClientId) {
      setConfiguredPlatforms([])
      return
    }
    const qs = new URLSearchParams({ client_id: String(selectedClientId) })
    fetch(`/api/ads/configured-platforms?${qs}`)
      .then(r => (r.ok ? r.json() : { platforms: [] }))
      .then(d => setConfiguredPlatforms(Array.isArray(d?.platforms) ? d.platforms : []))
      .catch(() => setConfiguredPlatforms([]))
  }, [selectedClientId])

  // state → URL 동기화. router.replace 로 변경해야 useSearchParams 갱신이 일어나 isActive 표시가 맞아진다.
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (tab === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.replace(`/ads${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      // 선택된 클라이언트가 있으면 명시적으로 client_id 를 전달 (전체 동기화 방지)
      const url = selectedClientId
        ? `/api/ads/sync?client_id=${selectedClientId}`
        : '/api/ads/sync'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()

      // 서버 응답: { success, results: [{ platform, count, error }, ...] }
      type SyncRow = { platform?: string; count?: number; error?: string | null }
      const results: SyncRow[] = Array.isArray(data?.results) ? data.results : []
      const successRows = results.filter(r => !r.error)
      const failedRows = results.filter(r => r.error)

      const summary = successRows
        .map(r => `${r.platform}: ${r.count ?? 0}`)
        .join(', ')

      if (failedRows.length === 0) {
        toast.success(`데이터 수집 완료${summary ? ` (${summary})` : ''}`)
      } else {
        const failSummary = failedRows
          .map(r => `${r.platform}: ${r.error}`)
          .join(' / ')
        toast.error(`일부 매체 수집 실패 — ${failSummary}`, { duration: 8000 })
        if (successRows.length > 0) {
          toast.success(`성공 매체 (${summary})`)
        }
      }
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
              {isSuperAdmin && selectedClientId && (
                <Button
                  variant="outline"
                  onClick={() => setBackfillOpen(true)}
                  disabled={syncing}
                  title="과거 광고 데이터 채우기 (최대 90일)"
                >
                  <History size={14} /> 데이터 백필
                </Button>
              )}
              {canEditManualInflow && selectedClientId && (
                <Button
                  variant="outline"
                  onClick={() => setManualInflowOpen(true)}
                  disabled={syncing}
                  title="ADN 등 매체 전환 누락 일자에 보정 인입 수 입력"
                >
                  <Pencil size={14} /> 인입 보정
                </Button>
              )}
              {canSync && (
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-brand-600 hover:bg-brand-700"
                >
                  <Play size={14} /> {syncing ? '수집 중...' : '지금 데이터 수집'}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {isSuperAdmin && selectedClientId && (
        <BackfillDialog
          open={backfillOpen}
          onOpenChange={setBackfillOpen}
          clientId={selectedClientId}
          clientName={selectedClient?.name}
          onComplete={handleRefresh}
        />
      )}

      {canEditManualInflow && selectedClientId && (
        <ManualInflowDialog
          open={manualInflowOpen}
          onOpenChange={setManualInflowOpen}
          clientId={selectedClientId}
          clientName={selectedClient?.name}
          platform="adn_ads"
          onSaved={handleRefresh}
        />
      )}

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
        <AdsCampaignTab
          key={`campaigns-${startDate}-${endDate}-${refreshKey}`}
          startDate={startDate}
          endDate={endDate}
          days={String(daysDiff)}
          platformFilter={campaignPlatformFilter}
          onPlatformFilterChange={setCampaignPlatformFilter}
        />
      )}
    </>
  )
}
