'use client'
import { StatsCard } from '@/components/common'
import { ShieldAlert, AlertTriangle, Clock, Search } from 'lucide-react'
import { getRiskLevel } from '@/lib/medichecker/risk-level'
import type { VerifyResult } from '@/lib/medichecker/types'

interface ResultKpiCardsProps {
  result: VerifyResult
  loading?: boolean
}

export function ResultKpiCards({ result, loading }: ResultKpiCardsProps) {
  const risk = getRiskLevel(result.riskScore)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      <StatsCard
        label="위험도"
        value={`${result.riskScore}점`}
        loading={loading}
        icon={ShieldAlert}
        subtitle={risk.label}
        subtitleColor={risk.subtitleColor}
      />
      <StatsCard
        label="위반 의심"
        value={`${result.violations.length}건`}
        loading={loading}
        icon={AlertTriangle}
      />
      <StatsCard
        label="처리 시간"
        value={`${(result.metadata.totalTimeMs / 1000).toFixed(1)}초`}
        loading={loading}
        icon={Clock}
      />
      <StatsCard
        label="법령 참조"
        value={`${result.metadata.ragChunksUsed}건`}
        loading={loading}
        icon={Search}
      />
    </div>
  )
}
