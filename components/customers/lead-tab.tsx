'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { Search, Plus, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useClient } from '@/components/ClientContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge, ChannelBadge, StatsCard } from '@/components/common'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { formatDate } from '@/lib/date'
import { LeadStatusDialog } from './lead-status-dialog'
import { ManualLeadForm } from './manual-lead-form'
import { LeadExportButton } from './lead-export-button'

const STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'new', label: '신규' },
  { value: 'in_progress', label: '진행중' },
  { value: 'converted', label: '전환' },
  { value: 'hold', label: '보류' },
  { value: 'lost', label: '미전환' },
  { value: 'invalid', label: '무효' },
]

interface LeadTabProps {
  onStatsChange?: (stats: { total: number; new_count: number; in_progress: number; converted: number }) => void
}

export function LeadTab({ onStatsChange }: LeadTabProps) {
  const { selectedClientId } = useClient()
  const { data: session } = useSession()
  const canExport = session?.user?.role === 'superadmin' || session?.user?.role === 'client_admin'

  const [leads, setLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const perPage = 50

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>({} as DateRange)

  // Dialogs
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [manualFormOpen, setManualFormOpen] = useState(false)

  // Stats (separate fetch without pagination)
  const [stats, setStats] = useState({ total: 0, new_count: 0, in_progress: 0, converted: 0, hold: 0 })

  const fetchLeads = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedClientId) params.set('client_id', String(selectedClientId))
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (channelFilter !== 'all') params.set('utm_source', channelFilter)
    if (campaignFilter !== 'all') params.set('campaign', campaignFilter)
    if (dateRange.from) params.set('date_from', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to) params.set('date_to', format(dateRange.to, 'yyyy-MM-dd'))
    params.set('page', String(page))
    params.set('per_page', String(perPage))

    fetch(`/api/customers/leads?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setLeads(d.data || [])
        setTotal(d.total || 0)
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [selectedClientId, statusFilter, channelFilter, campaignFilter, dateRange, page])

  const fetchStats = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedClientId) params.set('client_id', String(selectedClientId))
    params.set('per_page', '1') // minimal data, we just need counts

    // Fetch counts for each status
    const statuses = ['new', 'in_progress', 'converted', 'hold'] as const
    const promises = statuses.map(s => {
      const p = new URLSearchParams(params)
      p.set('status', s)
      return fetch(`/api/customers/leads?${p.toString()}`)
        .then(r => r.json())
        .then(d => ({ status: s, count: d.total || 0 }))
        .catch(() => ({ status: s, count: 0 }))
    })

    // Also fetch total
    const totalPromise = fetch(`/api/customers/leads?${params.toString()}`)
      .then(r => r.json())
      .then(d => d.total || 0)
      .catch(() => 0)

    Promise.all([totalPromise, ...promises]).then(([totalCount, ...results]) => {
      const s = {
        total: totalCount as number,
        new_count: 0,
        in_progress: 0,
        converted: 0,
        hold: 0,
      }
      results.forEach((r: any) => {
        if (r.status === 'new') s.new_count = r.count
        else if (r.status === 'in_progress') s.in_progress = r.count
        else if (r.status === 'converted') s.converted = r.count
        else if (r.status === 'hold') s.hold = r.count
      })
      setStats(s)
      onStatsChange?.({ total: s.total, new_count: s.new_count, in_progress: s.in_progress, converted: s.converted })
    })
  }, [selectedClientId, onStatsChange])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchStats() }, [fetchStats])

  // Extract unique channels and campaigns from loaded leads for filter dropdowns
  const channels = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => { if (l.utm_source) set.add(l.utm_source) })
    return Array.from(set).sort()
  }, [leads])

  const campaigns = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => { if (l.utm_campaign) set.add(l.utm_campaign) })
    return Array.from(set).sort()
  }, [leads])

  const totalPages = Math.ceil(total / perPage)

  const handleStatusClick = (lead: any) => {
    setSelectedLead(lead)
    setStatusDialogOpen(true)
  }

  const handleRefresh = () => {
    fetchLeads()
    fetchStats()
  }

  const activeFilterCount = [statusFilter, channelFilter, campaignFilter].filter(f => f !== 'all').length
    + (dateRange.from ? 1 : 0)

  const resetFilters = () => {
    setStatusFilter('all')
    setChannelFilter('all')
    setCampaignFilter('all')
    setDateRange({} as DateRange)
    setPage(1)
  }

  const exportFilters = {
    status: statusFilter,
    utm_source: channelFilter,
    campaign: campaignFilter,
    date_from: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    date_to: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
  }

  return (
    <div className="space-y-6">
      {/* 상태 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatsCard label="전체" value={`${stats.total}건`} loading={loading} onClick={() => { setStatusFilter('all'); setPage(1) }} />
        <StatsCard label="신규" value={`${stats.new_count}건`} loading={loading} onClick={() => { setStatusFilter('new'); setPage(1) }} />
        <StatsCard label="진행중" value={`${stats.in_progress}건`} loading={loading} onClick={() => { setStatusFilter('in_progress'); setPage(1) }} />
        <StatsCard label="전환" value={`${stats.converted}건`} loading={loading} onClick={() => { setStatusFilter('converted'); setPage(1) }} />
        <StatsCard label="보류" value={`${stats.hold}건`} loading={loading} onClick={() => { setStatusFilter('hold'); setPage(1) }} />
      </div>

      {/* 필터 + 액션 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground" />

          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[130px] text-xs">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {channels.length > 0 && (
            <Select value={channelFilter} onValueChange={v => { setChannelFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[130px] text-xs">
                <SelectValue placeholder="전체 채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                {channels.map(ch => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {campaigns.length > 0 && (
            <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[130px] text-xs">
                <SelectValue placeholder="전체 캠페인" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 캠페인</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <DateRangePicker dateRange={dateRange} onDateRangeChange={r => { setDateRange(r); setPage(1) }} />

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-muted-foreground">
              <X size={12} className="mr-1" /> 초기화
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {canExport && <LeadExportButton filters={exportFilters} />}
          <Button size="sm" onClick={() => setManualFormOpen(true)} className="text-xs">
            <Plus size={13} className="mr-1" /> 수동 등록
          </Button>
        </div>
      </div>

      {/* 리드 테이블 */}
      <Card className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800">
              <TableHead className="text-left font-medium text-slate-500 text-xs">이름</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">연락처</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">유입채널</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">캠페인</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">상태</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">전환금액</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">날짜</TableHead>
              <TableHead className="text-right font-medium text-slate-500 text-xs">결과 입력</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(8).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                  데이터가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              leads.map(lead => (
                <TableRow key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="text-left text-sm font-medium text-foreground">
                    {lead.contact?.name || '이름 없음'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {lead.contact?.phone_number || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <ChannelBadge channel={lead.utm_source || lead.contact?.first_source || '-'} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground truncate max-w-[120px]">
                    {lead.utm_campaign || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={lead.lead_status || 'new'} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {lead.conversion_value ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {Number(lead.conversion_value).toLocaleString()}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground font-mono">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {lead.lead_status === 'converted' || lead.lead_status === 'lost' || lead.lead_status === 'invalid' ? (
                      <span className="text-xs text-muted-foreground">완료</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-violet-600 hover:text-violet-700"
                        onClick={() => handleStatusClick(lead)}
                      >
                        입력
                      </Button>
                    )}
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
            총 {total}건 중 {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}건
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

      {/* 다이얼로그 */}
      {selectedLead && (
        <LeadStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          leadId={selectedLead.id}
          leadName={selectedLead.contact?.name || '이름 없음'}
          currentStatus={selectedLead.lead_status || 'new'}
          onSuccess={handleRefresh}
        />
      )}

      <ManualLeadForm
        open={manualFormOpen}
        onOpenChange={setManualFormOpen}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
