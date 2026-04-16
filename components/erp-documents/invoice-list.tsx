'use client'

import { useState, useEffect, useCallback } from 'react'
import { Receipt, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmptyState } from '@/components/common'
import { formatDate } from '@/lib/date'
import type {
  ERPInvoice,
  ERPInvoiceType,
  ERPInvoiceStatus,
  ERPPagination,
} from '@/types/erp'

const TYPE_LABELS: Record<ERPInvoiceType, string> = {
  transaction_statement: '거래명세서',
  tax_invoice: '세금계산서',
}

const STATUS_MAP: Record<ERPInvoiceStatus, { variant: 'success' | 'destructive'; label: string }> = {
  issued: { variant: 'success', label: '발행됨' },
  cancelled: { variant: 'destructive', label: '취소됨' },
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

interface InvoiceListProps {
  clinicId: number
}

export default function InvoiceList({ clinicId }: InvoiceListProps) {
  const [data, setData] = useState<ERPInvoice[]>([])
  const [pagination, setPagination] = useState<ERPPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ERPInvoice | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/erp-documents?type=invoices&clinic_id=${clinicId}&page=${page}&limit=20`
      )
      const json = await res.json()
      if (json.success) {
        setData(json.data ?? [])
        setPagination(json.pagination ?? null)
      } else {
        toast.error(json.error || '계산서 목록을 불러오지 못했습니다')
      }
    } catch {
      toast.error('계산서 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [clinicId, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const fetchDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(
        `/api/erp-documents/${id}?type=invoices&clinic_id=${clinicId}`
      )
      const json = await res.json()
      if (json.success) {
        setDetail(json.data)
      } else {
        toast.error(json.error || '계산서 상세를 불러오지 못했습니다')
      }
    } catch {
      toast.error('계산서 상세를 불러오지 못했습니다')
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) {
    return (
      <Card variant="glass" className="p-4 md:p-5">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card variant="glass" className="p-4 md:p-5">
        <EmptyState
          icon={Receipt}
          title="계산서가 없습니다"
          description="이 병원에 등록된 계산서가 없습니다."
        />
      </Card>
    )
  }

  return (
    <>
      <Card variant="glass" className="p-4 md:p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>문서번호</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">합계금액</TableHead>
              <TableHead>발행일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((invoice) => {
              const status = STATUS_MAP[invoice.status]
              return (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors duration-200"
                  onClick={() => fetchDetail(invoice.id)}
                >
                  <TableCell className="font-mono text-sm">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {TYPE_LABELS[invoice.type]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(invoice.total_amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invoice.issue_date)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              총 {pagination.totalCount.toLocaleString('ko-KR')}건
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>계산서 상세</SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded" />
              ))}
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">기본 정보</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">문서번호</p>
                  <p className="font-mono text-foreground">{detail.invoice_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">유형</p>
                  <p className="text-foreground">{TYPE_LABELS[detail.type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">상태</p>
                  <Badge variant={STATUS_MAP[detail.status].variant}>
                    {STATUS_MAP[detail.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">발행일</p>
                  <p className="text-foreground">{formatDate(detail.issue_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">공급가</p>
                  <p className="text-foreground">{formatAmount(detail.supply_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">세액</p>
                  <p className="text-foreground">{formatAmount(detail.tax_amount)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">합계</p>
                  <p className="font-semibold text-foreground">{formatAmount(detail.total_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">작성일</p>
                  <p className="text-foreground">{formatDate(detail.created_at)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
