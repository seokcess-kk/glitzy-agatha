'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClinic } from '@/components/ClinicContext'
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

interface LpRow {
  landingPageId: number
  name: string
  isActive: boolean
  leads: number
  bookings: number
  customers: number
  revenue: number
  leadToBookingRate: number
  conversionRate: number
}

interface Props {
  startDate: string
  endDate: string
}

export default function LpConversionTable({ startDate, endDate }: Props) {
  const { selectedClinicId } = useClinic()
  const [pages, setPages] = useState<LpRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))

      const res = await fetch(`/api/ads/landing-page-analysis?${qs}`)
      if (!res.ok) {
        setPages([])
        return
      }
      const json = await res.json()
      setPages(json?.pages || [])
    } catch {
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClinicId])

  useEffect(() => { fetchData() }, [fetchData])

  const hasConversionData = useMemo(
    () => pages.some(p => p.bookings > 0 || p.customers > 0 || p.revenue > 0),
    [pages]
  )

  const thClass = 'text-[11px] text-muted-foreground font-medium whitespace-nowrap'

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">랜딩페이지 전환 성과</h3>
        <span className="text-xs text-muted-foreground">{pages.length}개 페이지</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : pages.length === 0 || !hasConversionData ? (
        <EmptyState
          icon={FileText}
          title="LP 전환 데이터 없음"
          description="랜딩페이지에서 예약/결제 전환이 발생하면 표시됩니다."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className={thClass}>페이지명</TableHead>
                <TableHead className={`${thClass} text-right`}>리드</TableHead>
                <TableHead className={`${thClass} text-right`}>예약고객</TableHead>
                <TableHead className={`${thClass} text-right`}>예약전환율</TableHead>
                <TableHead className={`${thClass} text-right`}>결제고객</TableHead>
                <TableHead className={`${thClass} text-right`}>전환율</TableHead>
                <TableHead className={`${thClass} text-right`}>매출</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((row, idx) => (
                <TableRow
                  key={row.landingPageId}
                  className={`border-b border-border/50 dark:border-white/[0.03] ${
                    idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''
                  }`}
                >
                  <TableCell className="py-2.5 max-w-[160px]">
                    <span className="text-sm text-foreground/90 truncate block" title={row.name}>{row.name}</span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.bookings > 0 ? row.bookings.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm font-medium">
                    <span className={row.leadToBookingRate >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'}>
                      {row.leadToBookingRate > 0 ? `${row.leadToBookingRate.toFixed(1)}%` : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                    {row.customers > 0 ? row.customers.toLocaleString() : '-'}
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
