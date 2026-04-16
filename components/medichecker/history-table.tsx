'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Eye, ShieldAlert } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { EmptyState } from '@/components/common'
import { formatDateTime } from '@/lib/date'
import type { AdType } from '@/lib/medichecker/types'
import { AD_TYPE_LABELS } from '@/lib/medichecker/types'
import { getRiskLevel } from '@/lib/medichecker/risk-level'

interface HistoryItem {
  id: number
  created_at: string
  ad_type: AdType
  risk_score: number
  violation_count: number
  summary: string | null
}

interface HistoryResponse {
  data: HistoryItem[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 10

// getRiskLevel 유틸 사용 (lib/medichecker/risk-level.ts)

interface HistoryTableProps {
  onSelectHistory?: (id: number) => void
}

export function HistoryTable({ onSelectHistory }: HistoryTableProps) {
  const { selectedClinicId } = useClinic()
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (selectedClinicId) {
        params.set('clinic_id', String(selectedClinicId))
      }

      const res = await fetch(`/api/medichecker/history?${params}`)
      if (!res.ok) throw new Error('조회 실패')
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, selectedClinicId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <Card variant="glass" className="p-4 md:p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">검수 이력</h3>
        {data && (
          <span className="text-xs text-muted-foreground">
            총 {data.total}건
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 flex-1" />
            </div>
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="검수 이력이 없습니다"
          description="광고 문구를 검수하면 이력이 여기에 표시됩니다."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>일시</TableHead>
                <TableHead>매체</TableHead>
                <TableHead>위험도</TableHead>
                <TableHead>위반</TableHead>
                <TableHead className="hidden md:table-cell">요약</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs text-foreground whitespace-nowrap">
                    {formatDateTime(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {AD_TYPE_LABELS[item.ad_type] || item.ad_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRiskLevel(item.risk_score).badgeVariant} className="text-xs tabular-nums">
                      {item.risk_score}점 {getRiskLevel(item.risk_score).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground tabular-nums">
                    {item.violation_count ?? 0}건
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                    {item.summary || '-'}
                  </TableCell>
                  <TableCell>
                    {onSelectHistory && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onSelectHistory(item.id)}
                        aria-label="상세 보기"
                      >
                        <Eye size={14} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} />
                이전
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                다음
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
