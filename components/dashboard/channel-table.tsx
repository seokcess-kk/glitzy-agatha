'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ChannelBadge } from '@/components/common'
import { BarChart3, ArrowRight, ArrowUpDown } from 'lucide-react'
import { CHART_SEMANTIC } from '@/lib/chart-colors'
import Link from 'next/link'

interface ChannelData {
  channel: string
  leads: number
  spend: number
  revenue: number
  cpl: number
  roas: number
  clicks: number
  impressions: number
  ctr: number
}

interface ChannelTableProps {
  data: ChannelData[]
  loading?: boolean
}

type SortKey = 'leads' | 'spend' | 'cpl' | 'clicks' | 'ctr' | 'roas'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'spend', label: '광고비' },
  { key: 'leads', label: '리드' },
  { key: 'cpl', label: 'CPL' },
  { key: 'clicks', label: '클릭' },
  { key: 'ctr', label: 'CTR' },
  { key: 'roas', label: 'ROAS' },
]

/** 광고 데이터가 있는 채널인지 (clicks/impressions/spend 중 하나라도 있으면) */
function hasAdData(row: ChannelData): boolean {
  return row.spend > 0 || row.clicks > 0 || row.impressions > 0
}

export function ChannelTable({ data, loading }: ChannelTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('leads')
  const [sortAsc, setSortAsc] = useState(false)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    return sortAsc ? av - bv : bv - av
  })

  // ROAS 최대값 (바 너비 계산용)
  const maxRoas = Math.max(...data.map(d => d.roas), 1)

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-foreground">채널 성과</h2>
        </div>
        <Link
          href="/ads"
          className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          광고 성과 상세
          <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <Skeleton className="h-[200px] rounded-lg" />
      ) : sorted.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border dark:border-white/5">
                <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">채널</th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="text-right text-xs font-medium text-muted-foreground py-2 px-2"
                    aria-sort={sortKey === col.key ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col.label}
                      <ArrowUpDown size={10} className={sortKey === col.key ? 'text-brand-400' : 'opacity-30'} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.channel}
                  className="border-b border-border/50 dark:border-white/[0.03] hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <td className="py-2.5 pr-4">
                    <ChannelBadge channel={row.channel} />
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-foreground/80">
                    {row.spend > 0 ? `₩${row.spend.toLocaleString()}` : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums font-medium text-foreground">
                    {row.leads.toLocaleString()}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-foreground/80">
                    {row.cpl > 0 ? `₩${row.cpl.toLocaleString()}` : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-foreground/80">
                    {hasAdData(row) ? row.clicks.toLocaleString() : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-foreground/80">
                    {hasAdData(row) ? `${row.ctr}%` : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 min-w-[120px]">
                    {row.roas > 0 ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((row.roas / maxRoas) * 100, 100)}%`,
                              backgroundColor: row.roas >= 1 ? CHART_SEMANTIC.positiveStrong : CHART_SEMANTIC.negativeStrong,
                            }}
                          />
                        </div>
                        <span className={`tabular-nums font-medium text-xs ${
                          row.roas >= 1
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {(row.roas * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="채널 데이터 없음"
          description="광고 캠페인이 시작되면 채널별 성과가 표시됩니다."
        />
      )}
    </Card>
  )
}
