'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClient } from '@/components/ClientContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText } from 'lucide-react'

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

interface LandingPageRow {
  landingPageId: string
  name: string
  isActive: boolean
  leads: number
  contacts: number
  revenue: number
  conversionRate: number
}

interface Props {
  startDate: string
  endDate: string
}

export default function LandingPagePerformance({ startDate, endDate }: Props) {
  const { selectedClientId } = useClient()
  const [rows, setRows] = useState<LandingPageRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))

      const res = await fetch(`/api/ads/landing-page-performance?${qs}`)
      if (!res.ok) {
        setRows([])
        return
      }
      const json = await res.json()
      setRows(Array.isArray(json?.pages) ? json.pages : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const thClass = 'text-[11px] text-muted-foreground font-medium whitespace-nowrap'

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">랜딩페이지별 성과</h2>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="랜딩페이지 데이터가 없습니다"
          description="랜딩페이지가 등록되면 성과를 확인할 수 있습니다."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className={thClass}>페이지명</TableHead>
                <TableHead className={`${thClass} text-right`}>리드</TableHead>
                <TableHead className={`${thClass} text-right`}>결제 고객</TableHead>
                <TableHead className={`${thClass} text-right`}>전환율</TableHead>
                <TableHead className={`${thClass} text-right`}>매출</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={row.landingPageId}
                  className={`border-b border-border/50 dark:border-white/[0.03] ${
                    idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''
                  }`}
                >
                  <TableCell className="py-2.5 max-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground/90 truncate block" title={row.name}>
                        {row.name}
                      </span>
                      {!row.isActive && (
                        <span className="text-[10px] text-muted-foreground shrink-0">(비활성)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.contacts.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm font-medium">
                    <span className={row.conversionRate >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'}>
                      {row.conversionRate > 0 ? `${row.conversionRate.toFixed(1)}%` : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.revenue > 0 ? `₩${row.revenue.toLocaleString()}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
