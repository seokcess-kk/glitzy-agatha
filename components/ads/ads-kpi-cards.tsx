'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClient } from '@/components/ClientContext'
import { StatsCard } from '@/components/common'

interface KpiComparison {
  cpl: number
  roas: number
  totalLeads: number
  totalSpend: number
  cac: number
  cpc: number
  ctr: number
}

interface KpiData {
  totalSpend: number
  totalLeads: number
  cpl: number
  roas: number
  cac: number
  totalClicks: number
  totalImpressions: number
  cpc: number
  ctr: number
  payingContactCount: number
  comparison?: KpiComparison
}

interface Props {
  startDate: string
  endDate: string
}

export default function AdsKpiCards({ startDate, endDate }: Props) {
  const { selectedClientId } = useClient()
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ compare: 'true', startDate, endDate })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))

      const res = await fetch(`/api/dashboard/kpi?${qs}`)
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

  const totalSpend = data?.totalSpend ?? 0
  const totalLeads = data?.totalLeads ?? 0
  const cpl = data?.cpl ?? 0
  const cpc = data?.cpc ?? 0
  const ctr = data?.ctr ?? 0
  const comparison = data?.comparison

  // 일반 지표: 양수 변화 = isPositive true
  const normalTrend = (val: number | undefined): { value: number; isPositive: boolean } | undefined => {
    if (val === undefined || val === null) return undefined
    return { value: Math.abs(val), isPositive: val >= 0 }
  }

  // 역전 지표 (CPL, CPC): 음수 변화(감소) = 좋은 것 → isPositive true
  const invertedTrend = (val: number | undefined): { value: number; isPositive: boolean } | undefined => {
    if (val === undefined || val === null) return undefined
    return { value: Math.abs(val), isPositive: val <= 0 }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <StatsCard
        label="총 광고비"
        value={loading ? '' : `₩${totalSpend.toLocaleString()}`}
        loading={loading}
        trend={normalTrend(comparison?.totalSpend)}
      />
      <StatsCard
        label="총 리드"
        value={loading ? '' : totalLeads.toLocaleString()}
        loading={loading}
        trend={normalTrend(comparison?.totalLeads)}
      />
      <StatsCard
        label="CPL"
        value={loading ? '' : `₩${cpl.toLocaleString()}`}
        loading={loading}
        trend={invertedTrend(comparison?.cpl)}
      />
      <StatsCard
        label="CPC"
        value={loading ? '' : `₩${cpc.toLocaleString()}`}
        loading={loading}
        trend={invertedTrend(comparison?.cpc)}
      />
      <StatsCard
        label="CTR"
        value={loading ? '' : `${ctr.toFixed(2)}%`}
        loading={loading}
        trend={normalTrend(comparison?.ctr)}
      />
    </div>
  )
}
