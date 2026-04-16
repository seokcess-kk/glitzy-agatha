'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from '@/components/charts'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { PieChart as PieChartIcon } from 'lucide-react'
import { ChartTooltipProps } from '@/types/recharts'
import { PIE_SHADES } from '@/lib/chart-colors'
const MAX_ITEMS = 5

interface TreatmentData {
  name: string
  amount: number
}

interface TreatmentPieProps {
  data: TreatmentData[]
  loading?: boolean
}

const fmtKrw = (v: number) => `₩${(v / 10000).toFixed(0)}만`

const PieTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="text-muted-foreground">{d.name}: <span className="text-foreground font-medium">{fmtKrw(d.value)}</span></p>
    </div>
  )
}

function groupData(data: TreatmentData[]): TreatmentData[] {
  const filtered = data.filter(d => d.amount > 0)
  if (filtered.length <= MAX_ITEMS) return filtered

  const top = filtered.slice(0, MAX_ITEMS)
  const rest = filtered.slice(MAX_ITEMS)
  const etcAmount = rest.reduce((sum, d) => sum + d.amount, 0)
  return [...top, { name: '기타', amount: etcAmount }]
}

export function TreatmentPie({ data, loading }: TreatmentPieProps) {
  const grouped = groupData(data)
  const total = grouped.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Card variant="glass" className="p-5 w-full">
      <h2 className="text-sm font-semibold text-foreground mb-4">시술별 매출 비중</h2>

      {loading ? (
        <Skeleton className="h-[240px] rounded-lg" />
      ) : grouped.length > 0 ? (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={grouped}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="amount"
                  stroke="none"
                >
                  {grouped.map((_, i) => (
                    <Cell key={i} fill={PIE_SHADES[i % PIE_SHADES.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">총 매출</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{fmtKrw(total)}</p>
              </div>
            </div>
          </div>

          <ul className="space-y-1.5 mt-2">
            {grouped.map((d, i) => {
              const pct = total > 0 ? ((d.amount / total) * 100).toFixed(0) : '0'
              return (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: PIE_SHADES[i % PIE_SHADES.length] }}
                    />
                    <span className="text-muted-foreground truncate">{d.name}</span>
                  </span>
                  <span className="font-semibold text-foreground tabular-nums shrink-0 ml-2">
                    {fmtKrw(d.amount)} ({pct}%)
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <EmptyState
          icon={PieChartIcon}
          title="결제 데이터 없음"
          description="결제가 발생하면 시술별 매출 비중이 표시됩니다."
        />
      )}
    </Card>
  )
}
