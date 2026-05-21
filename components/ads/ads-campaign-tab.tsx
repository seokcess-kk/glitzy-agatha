'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClient } from '@/components/ClientContext'
import { Button } from '@/components/ui/button'
import { API_PLATFORM_LABELS } from '@/lib/platform'
import CampaignRankingTable from '@/components/ads/campaign-ranking-table'
import CreativePerformance from '@/components/ads/CreativePerformance'
import LandingPageAnalysis from '@/components/ads/landing-page-analysis'

interface Props {
  startDate: string
  endDate: string
  days: string
}

export default function AdsCampaignTab({ startDate, endDate, days }: Props) {
  const { selectedClientId } = useClient()
  const [platformFilter, setPlatformFilter] = useState('all')
  const [platforms, setPlatforms] = useState<string[]>(['all'])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  const fetchPlatforms = useCallback(async () => {
    try {
      // client_api_configs 의 활성 매체만 노출 (과거 데이터만 남은 매체 제외)
      const qs = new URLSearchParams()
      if (selectedClientId) qs.set('client_id', String(selectedClientId))
      const res = await fetch(`/api/ads/configured-platforms?${qs.toString()}`)
      if (!res.ok) return
      const json = await res.json()
      const list: string[] = Array.isArray(json?.platforms) ? json.platforms : []
      setPlatforms(['all', ...list])
    } catch {
      // silently fail — keep default ['all']
    }
  }, [selectedClientId])

  useEffect(() => {
    fetchPlatforms()
  }, [fetchPlatforms])

  useEffect(() => {
    if (platformFilter !== 'all' && !platforms.includes(platformFilter)) {
      setPlatformFilter('all')
    }
  }, [platforms, platformFilter])

  // 매체 필터 변경 시 캠페인 선택 초기화
  useEffect(() => {
    setSelectedCampaignId(null)
  }, [platformFilter])

  return (
    <>
      <div className="flex gap-2 mb-6 flex-wrap">
        {platforms.map(p => (
          <Button
            key={p}
            variant={platformFilter === p ? 'default' : 'ghost'}
            onClick={() => setPlatformFilter(p)}
            className={platformFilter === p ? 'bg-brand-600 border-brand-600' : ''}
          >
            {p === 'all' ? '전체 매체' : (API_PLATFORM_LABELS[p as keyof typeof API_PLATFORM_LABELS] || p)}
          </Button>
        ))}
      </div>
      <CampaignRankingTable
        startDate={startDate}
        endDate={endDate}
        platformFilter={platformFilter === 'all' ? undefined : platformFilter}
        selectedCampaignId={selectedCampaignId}
        onCampaignSelect={setSelectedCampaignId}
      />
      <CreativePerformance
        startDate={startDate}
        endDate={endDate}
        campaignFilter={selectedCampaignId}
        platformFilter={platformFilter === 'all' ? undefined : platformFilter}
      />
      <div className="mt-6" />
      <LandingPageAnalysis startDate={startDate} endDate={endDate} mode="delivery" />
    </>
  )
}
