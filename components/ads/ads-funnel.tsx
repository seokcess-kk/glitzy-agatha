'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClient } from '@/components/ClientContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { TrendingDown, Lightbulb, ChevronDown } from 'lucide-react'

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

interface AdStatsRecord {
  impressions: number
  clicks: number
  spend: number
}

interface FunnelStage {
  stage: string
  count: number
}

interface FunnelData {
  stages: FunnelStage[]
}

interface FunnelResponse {
  type: string
  funnel: FunnelData
}

interface Props {
  startDate: string
  endDate: string
}

export default function AdsFunnel({ startDate, endDate }: Props) {
  const { selectedClientId } = useClient()

  const [adsLoading, setAdsLoading] = useState(true)
  const [funnelLoading, setFunnelLoading] = useState(true)
  const [impressions, setImpressions] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [leadCount, setLeadCount] = useState(0)
  const [hasData, setHasData] = useState(false)

  const loading = adsLoading || funnelLoading

  const fetchAdsStats = useCallback(async () => {
    setAdsLoading(true)
    try {
      const days = String(Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1))
      const qs = new URLSearchParams({ days })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))

      const res = await fetch(`/api/ads/stats?${qs}`)
      if (!res.ok) return

      const json = await res.json()
      const records: AdStatsRecord[] = Array.isArray(json) ? json : (Array.isArray(json?.stats) ? json.stats : [])

      setImpressions(records.reduce((sum, r) => sum + (r.impressions || 0), 0))
      setClicks(records.reduce((sum, r) => sum + (r.clicks || 0), 0))
    } catch {
      // silently fail
    } finally {
      setAdsLoading(false)
    }
  }, [startDate, endDate, selectedClientId])

  const fetchFunnelData = useCallback(async () => {
    setFunnelLoading(true)
    try {
      const qs = new URLSearchParams({ groupBy: 'total', startDate, endDate })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))

      const res = await fetch(`/api/dashboard/funnel?${qs}`)
      if (!res.ok) return

      const json: FunnelResponse = await res.json()
      const stages = json?.funnel?.stages ?? []
      setLeadCount(stages.find(s => s.stage === 'Lead')?.count ?? 0)
    } catch {
      // silently fail
    } finally {
      setFunnelLoading(false)
    }
  }, [startDate, endDate, selectedClientId])

  useEffect(() => {
    fetchAdsStats()
    fetchFunnelData()
  }, [fetchAdsStats, fetchFunnelData])

  useEffect(() => {
    if (!loading) {
      setHasData(impressions > 0 || clicks > 0 || leadCount > 0)
    }
  }, [loading, impressions, clicks, leadCount])

  const metrics = useMemo(() => {
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const clickToLead = clicks > 0 ? (leadCount / clicks) * 100 : 0
    return { ctr, clickToLead }
  }, [impressions, clicks, leadCount])

  const worstDropoff = useMemo(() => {
    const stages = [
      { from: '노출', to: '클릭', rate: impressions > 0 ? 100 - (clicks / impressions) * 100 : 0 },
      { from: '클릭', to: '리드', rate: clicks > 0 ? 100 - (leadCount / clicks) * 100 : 0 },
    ]
    return stages.reduce((worst, s) => (s.rate > worst.rate ? s : worst), stages[0])
  }, [impressions, clicks, leadCount])

  const steps = useMemo(() => [
    { label: '노출', count: impressions, rate: null as string | null, rateLabel: null as string | null },
    { label: '클릭', count: clicks, rate: metrics.ctr > 0 ? `${metrics.ctr.toFixed(1)}%` : null, rateLabel: 'CTR' },
    { label: '리드', count: leadCount, rate: metrics.clickToLead > 0 ? `${metrics.clickToLead.toFixed(1)}%` : null, rateLabel: '전환율' },
  ], [impressions, clicks, leadCount, metrics])

  return (
    <Card variant="glass" className="p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">광고 퍼널</h2>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {loading ? (
        <div className="space-y-6 py-2 flex-1">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={TrendingDown}
          title="퍼널 데이터가 없습니다"
          description="광고 통계 및 리드 데이터가 유입되면 표시됩니다."
        />
      ) : (
        <div className="flex flex-col items-center flex-1 justify-center">
          {steps.map((step, idx) => (
            <div key={step.label} className="w-full">
              {/* 전환율 화살표 (첫 단계 제외) */}
              {idx > 0 && (
                <div className="flex items-center justify-center gap-1.5 py-1.5">
                  <ChevronDown size={14} className="text-muted-foreground/40" />
                  {step.rate && (
                    <span className={`text-xs tabular-nums font-medium ${
                      Number(step.rate.replace('%', '')) < 5
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-muted-foreground'
                    }`}>
                      {step.rateLabel} {step.rate}
                    </span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground/40" />
                </div>
              )}

              {/* 단계 카드 */}
              <div className={`rounded-lg p-3 text-center ${
                idx === 0
                  ? 'bg-brand-500/10 dark:bg-brand-500/10 border border-brand-500/20'
                  : idx === steps.length - 1
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-muted/50 dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06]'
              }`}>
                <p className="text-xs text-muted-foreground mb-0.5">{step.label}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{step.count.toLocaleString()}</p>
              </div>
            </div>
          ))}

          {/* 인사이트 */}
          {worstDropoff.rate > 0 && (
            <div className="w-full mt-4 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <Lightbulb size={12} className="text-amber-500 shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">{worstDropoff.from}→{worstDropoff.to}</span> 이탈{' '}
                <span className="font-semibold">{worstDropoff.rate.toFixed(1)}%</span>
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
