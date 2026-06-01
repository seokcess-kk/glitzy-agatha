'use client'

import { useState, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useClientData } from '@/hooks/use-client-data'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChannelBadge } from '@/components/common'
import { formatDate } from '@/lib/date'

export function ContactTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const perPage = 50

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // 공통 데이터 패칭 훅 — client_id 자동 부착 + loading/abort 처리 (기존 raw fetch 와 동작 동일)
  const { data, loading } = useClientData<{ data: any[]; total: number }>(
    '/api/customers/contacts',
    { search: debouncedSearch, page, per_page: perPage },
  )
  const contacts = data?.data ?? []
  const total = data?.total ?? 0

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="space-y-6">
      {/* 검색 바 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="이름 또는 전화번호 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          총 {total}명
        </p>
      </div>

      {/* 고객 테이블 */}
      <Card className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800">
              <TableHead className="text-left font-medium text-slate-500 text-xs">이름</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">전화번호</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">최초 유입 채널</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">총 문의 수</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">총 전환 금액</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">가입일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  {search ? `'${search}' 검색 결과가 없습니다` : '데이터가 없습니다'}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map(contact => (
                <TableRow key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="text-left text-sm font-medium text-foreground">
                    {contact.name || '이름 없음'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {contact.phone_number || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <ChannelBadge channel={contact.first_source || '-'} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono text-foreground">
                    {contact.lead_count || 0}회
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {contact.total_conversion_value && Number(contact.total_conversion_value) > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {Number(contact.total_conversion_value).toLocaleString()}원
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground font-mono">
                    {formatDate(contact.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            총 {total}명 중 {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}명
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
