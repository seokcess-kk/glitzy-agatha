'use client'

import { useState, useEffect, useCallback } from 'react'
import { Receipt, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/common'
import { formatDate } from '@/lib/date'
import type {
  ERPQuote,
  ERPQuoteDetail,
  ERPQuoteStatus,
  ERPPagination,
} from '@/types/erp'

const STATUS_MAP: Record<ERPQuoteStatus, { variant: 'warning' | 'success' | 'info' | 'destructive'; label: string }> = {
  sent: { variant: 'warning', label: '발송됨' },
  approved: { variant: 'success', label: '승인됨' },
  converted: { variant: 'info', label: '전환됨' },
  rejected: { variant: 'destructive', label: '반려됨' },
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

interface QuoteListProps {
  clientId: number
}

export default function QuoteList({ clientId }: QuoteListProps) {
  const [data, setData] = useState<ERPQuote[]>([])
  const [pagination, setPagination] = useState<ERPPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ERPQuoteDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 승인/반려 상태
  const [responding, setResponding] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/erp-documents?type=quotes&client_id=${clientId}&page=${page}&limit=20`
      )
      const json = await res.json()
      if (json.success) {
        setData(json.data ?? [])
        setPagination(json.pagination ?? null)
      } else {
        toast.error(json.error || '견적서 목록을 불러오지 못했습니다')
      }
    } catch {
      toast.error('견적서 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [clientId, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const fetchDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(
        `/api/erp-documents/${id}?type=quotes&client_id=${clientId}`
      )
      const json = await res.json()
      if (json.success) {
        setDetail(json.data)
      } else {
        toast.error(json.error || '견적서 상세를 불러오지 못했습니다')
      }
    } catch {
      toast.error('견적서 상세를 불러오지 못했습니다')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRespond = async (action: 'approve' | 'reject', reason?: string) => {
    if (!selectedId || !detail) return
    setResponding(true)
    try {
      const res = await fetch(
        `/api/erp-documents/${selectedId}/respond?client_id=${clientId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        }
      )
      const json = await res.json()
      if (json.success) {
        toast.success(action === 'approve' ? '견적서가 승인되었습니다' : '견적서가 반려되었습니다')
        // 상세 상태 즉시 반영
        const newStatus = json.data?.data?.status || (action === 'approve' ? 'approved' : 'rejected')
        setDetail({ ...detail, status: newStatus })
        // 목록도 새로고침
        fetchList()
      } else {
        toast.error(json.error || '처리에 실패했습니다')
      }
    } catch {
      toast.error('처리에 실패했습니다')
    } finally {
      setResponding(false)
    }
  }

  const handleApprove = () => handleRespond('approve')

  const handleRejectConfirm = async () => {
    setRejectDialogOpen(false)
    await handleRespond('reject', rejectReason || undefined)
    setRejectReason('')
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
          title="견적서가 없습니다"
          description="이 클라이언트에 등록된 견적서가 없습니다."
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
              <TableHead>제목</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">합계금액</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead>발송일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((quote) => {
              const status = STATUS_MAP[quote.status]
              return (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors duration-200"
                  onClick={() => fetchDetail(quote.id)}
                >
                  <TableCell className="font-mono text-sm">
                    {quote.quote_number}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {quote.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(quote.total_amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {quote.valid_until ? formatDate(quote.valid_until) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {quote.sent_at ? formatDate(quote.sent_at) : '-'}
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
            <SheetTitle>견적서 상세</SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded" />
              ))}
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-6">
              {/* 기본 정보 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">기본 정보</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">문서번호</p>
                    <p className="font-mono text-foreground">{detail.quote_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">상태</p>
                    <Badge variant={STATUS_MAP[detail.status].variant}>
                      {STATUS_MAP[detail.status].label}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">제목</p>
                    <p className="text-foreground">{detail.title}</p>
                  </div>
                  {detail.clients && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">거래처</p>
                      <p className="text-foreground">{detail.clients.name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">공급가</p>
                    <p className="text-foreground">{formatAmount(detail.supply_amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">세액</p>
                    <p className="text-foreground">{formatAmount(detail.tax_amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">합계</p>
                    <p className="font-semibold text-foreground">{formatAmount(detail.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">유효기간</p>
                    <p className="text-foreground">
                      {detail.valid_until ? formatDate(detail.valid_until) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">발송일</p>
                    <p className="text-foreground">
                      {detail.sent_at ? formatDate(detail.sent_at) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">작성일</p>
                    <p className="text-foreground">{formatDate(detail.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* 품목 테이블 */}
              {detail.quote_items && detail.quote_items.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">품목 내역</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>품목</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead className="text-right">단가</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.quote_items
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <p className="text-foreground">{item.description}</p>
                                {item.specification && (
                                  <p className="text-xs text-muted-foreground">{item.specification}</p>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.quantity} {item.unit}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatAmount(item.unit_price)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatAmount(item.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* 승인/반려 버튼 — sent 상태에서만 노출 */}
              {detail.status === 'sent' && (
                <div className="flex gap-3 pt-2 border-t border-border">
                  <Button
                    className="flex-1"
                    disabled={responding}
                    onClick={handleApprove}
                  >
                    <Check size={16} className="mr-1.5" />
                    {responding ? '처리 중...' : '승인'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={responding}
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    <X size={16} className="mr-1.5" />
                    반려
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* 반려 사유 입력 다이얼로그 */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>견적서 반려</AlertDialogTitle>
            <AlertDialogDescription>
              이 견적서를 반려합니다. 사유를 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="반려 사유 (선택)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={1000}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectReason(''); setRejectDialogOpen(false) }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              반려
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
