'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { Wallet } from 'lucide-react'

export interface BudgetData {
  monthlyBudget: number
  spentAmount: number
  burnRate: number
  projectedSpend: number
}

interface BudgetGaugeProps {
  data: BudgetData | null
  loading?: boolean
}

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}만`
  }
  return value.toLocaleString()
}

function getBurnColor(rate: number): string {
  if (rate >= 100) return 'bg-rose-500'
  if (rate >= 80) return 'bg-amber-500'
  return 'bg-violet-600'
}

function getBurnTextColor(rate: number): string {
  if (rate >= 100) return 'text-rose-600 dark:text-rose-400'
  if (rate >= 80) return 'text-amber-600 dark:text-amber-400'
  return 'text-violet-600 dark:text-violet-400'
}

export function BudgetGauge({ data, loading }: BudgetGaugeProps) {
  return (
    <Card variant="glass" className="p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-foreground">예산 소진 현황</h2>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[120px] rounded-lg" />
      ) : data && data.monthlyBudget > 0 ? (
        <div className="space-y-4">
          {/* 소진율 프로그레스 바 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">소진율</span>
              <span className={`text-base font-bold tabular-nums ${getBurnTextColor(data.burnRate)}`}>
                {data.burnRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${getBurnColor(data.burnRate)}`}
                style={{ width: `${Math.min(data.burnRate, 100)}%` }}
              />
            </div>
          </div>

          {/* 현재 지출 / 월 예산 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">현재 지출 / 월 예산</span>
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatCurrency(data.spentAmount)} / {formatCurrency(data.monthlyBudget)}
            </span>
          </div>

          {/* 예상 월말 지출 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">예상 월말 지출</span>
            <span className={`text-sm font-medium tabular-nums ${
              data.projectedSpend > data.monthlyBudget
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-foreground'
            }`}>
              {formatCurrency(data.projectedSpend)}
            </span>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Wallet}
          title="예산 미설정"
          description="클라이언트 월 예산이 설정되면 소진 현황이 표시됩니다."
        />
      )}
    </Card>
  )
}
