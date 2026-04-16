'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { TrendingDown } from 'lucide-react'
import { FUNNEL_GRADIENT } from '@/lib/chart-colors'

interface FunnelStage {
  stage: string
  count: number
}

interface FunnelResponse {
  funnel: { stages: FunnelStage[] }
}

interface Props {
  startDate: string
  endDate: string
}

export default function ConversionFunnel({ startDate, endDate }: Props) {
  const { selectedClinicId } = useClinic()
  const [loading, setLoading] = useState(true)
  const [leadCount, setLeadCount] = useState(0)
  const [bookingCount, setBookingCount] = useState(0)
  const [paymentCount, setPaymentCount] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ groupBy: 'total', startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/dashboard/funnel?${qs}`)
      if (!res.ok) return

      const json: FunnelResponse = await res.json()
      const stages = json?.funnel?.stages ?? []
      setLeadCount(stages.find(s => s.stage === 'Lead')?.count ?? 0)
      setBookingCount(stages.find(s => s.stage === 'Booking')?.count ?? 0)
      setPaymentCount(stages.find(s => s.stage === 'Payment')?.count ?? 0)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => { fetchData() }, [fetchData])

  const hasData = leadCount > 0 || bookingCount > 0 || paymentCount > 0
  const maxCount = useMemo(() => Math.max(leadCount, bookingCount, paymentCount, 1), [leadCount, bookingCount, paymentCount])

  const stages = useMemo(() => [
    { label: '리드', count: leadCount },
    { label: '예약', count: bookingCount },
    { label: '결제', count: paymentCount },
  ], [leadCount, bookingCount, paymentCount])

  const conversionRate = leadCount > 0 ? ((paymentCount / leadCount) * 100).toFixed(1) : '0'

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">전환 퍼널</h3>
        <span className="text-xs text-muted-foreground">리드→결제 {conversionRate}%</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" style={{ width: `${90 - i * 20}%` }} />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={TrendingDown}
          title="전환 데이터 없음"
          description="리드/예약/결제 데이터가 쌓이면 표시됩니다."
        />
      ) : (
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
            const prevCount = idx > 0 ? stages[idx - 1].count : 0
            const rate = prevCount > 0 ? ((stage.count / prevCount) * 100).toFixed(1) : null

            return (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{stage.label}</span>
                    {rate && (
                      <span className="text-muted-foreground">
                        <span className={Number(rate) < 20 ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'text-foreground/70 font-medium'}>
                          {rate}%
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums text-foreground/80 font-medium">{stage.count.toLocaleString()}</span>
                </div>
                <div className="h-7 bg-muted/40 dark:bg-white/[0.04] rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${Math.max(widthPct, stage.count > 0 ? 3 : 0)}%`,
                      background: FUNNEL_GRADIENT,
                      opacity: 1 - idx * 0.2,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
