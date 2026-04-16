'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Megaphone, ArrowLeft, Phone, Clock, ChevronRight, RefreshCw, FileText, User, ShieldCheck, StickyNote, Search, X } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { PageHeader, ChannelBadge, SortSelect } from '@/components/common'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { DateRange } from 'react-day-picker'
import { startOfDay, endOfDay } from 'date-fns'
import { formatDateTime } from '@/lib/date'
import { normalizeChannel } from '@/lib/channel'

const LEADS_PER_PAGE = 50

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:        { label: '신규',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  no_answer:  { label: '부재',     color: 'bg-muted text-muted-foreground border-border dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30' },
  booked:     { label: '예약완료', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  hold:       { label: '보류',     color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  rejected:   { label: '거절',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

// 기존 consulted 상태 리드 표시용 (신규 선택 불가)
const LEGACY_STATUS: Record<string, { label: string; color: string }> = {
  consulted:  { label: '상담완료', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
}

interface CampaignSummary {
  campaign: string
  channel: string
  lead_count: number
  chatbot_sent_count: number
  landing_pages: string[]
  latest_at: string
  today_count: number
}

interface CampaignLead {
  id: number
  customer_id: number
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  chatbot_sent: boolean
  chatbot_sent_at: string | null
  created_at: string
  landing_page_id: number | null
  lead_status: string
  notes: string | null
  custom_data: { survey?: Record<string, string>; marketing_consent?: boolean; name?: string } | null
  customer: { id: number; name: string; phone_number: string; first_source: string } | null
  landing_page: { id: number; name: string } | null
}

function timeAgo(dateStr: string): string {
  // timezone 정보 없는 Supabase timestamp → UTC로 취급
  const ts = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

// ─── 캠페인 목록 ───

const CAMPAIGN_SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'leads', label: '리드 많은순' },
  { value: 'today', label: '오늘 유입순' },
  { value: 'name', label: '이름순' },
]


function CampaignList({ campaigns, loading, onSelect, onRefresh }: {
  campaigns: CampaignSummary[]
  loading: boolean
  onSelect: (campaign: string) => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')

  // 캠페인 데이터에서 실제 존재하는 채널 동적 추출
  const availableChannels = useMemo(() => {
    const chSet = new Set<string>()
    campaigns.forEach(c => {
      const ch = normalizeChannel(c.channel)
      if (ch !== 'Unknown') chSet.add(ch)
    })
    return Array.from(chSet).sort()
  }, [campaigns])

  const filtered = useMemo(() => {
    let result = campaigns

    // 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(c => c.campaign.toLowerCase().includes(q))
    }

    // 채널 필터
    if (channelFilter !== 'all') {
      result = result.filter(c => normalizeChannel(c.channel) === channelFilter)
    }

    // 정렬
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'leads': return b.lead_count - a.lead_count
        case 'today': return b.today_count - a.today_count
        case 'name': return a.campaign.localeCompare(b.campaign, 'ko')
        default: return new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
      }
    })

    return result
  }, [campaigns, search, channelFilter, sortBy])

  const totalLeads = filtered.reduce((s, c) => s + c.lead_count, 0)
  const todayLeads = filtered.reduce((s, c) => s + c.today_count, 0)

  const activeFilterCount = (search ? 1 : 0) + (channelFilter !== 'all' ? 1 : 0) + (sortBy !== 'latest' ? 1 : 0)

  return (
    <>
      <PageHeader
        title="캠페인 리드"
        description="캠페인별 유입 리드를 확인합니다."
        actions={
          <Button variant="glass" size="sm" onClick={onRefresh}>
            <RefreshCw size={14} /> 새로고침
          </Button>
        }
      />

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Card variant="glass" className="flex items-center px-3 py-1.5 flex-1 max-w-xs min-w-[180px]">
          <Search size={14} className="text-muted-foreground mr-2 shrink-0" />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="캠페인명 검색"
            className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 p-0 h-auto"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground shrink-0 ml-1 cursor-pointer">
              <X size={13} />
            </button>
          )}
        </Card>
        {availableChannels.length > 1 && (
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-auto min-w-[110px] h-9 bg-card border-border dark:border-white/10 text-xs">
              <SelectValue>
                {channelFilter === 'all' ? '채널 전체' : channelFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">채널 전체</SelectItem>
              {availableChannels.map(ch => (
                <SelectItem key={ch} value={ch}>{ch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <SortSelect
          value={sortBy}
          onValueChange={setSortBy}
          options={CAMPAIGN_SORT_OPTIONS}
        />
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(''); setChannelFilter('all'); setSortBy('latest') }}
          >
            <X size={12} className="mr-1" />
            필터 초기화
          </Button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '활성 캠페인', value: filtered.length, color: 'text-foreground' },
          { label: '전체 리드', value: totalLeads, color: 'text-brand-400' },
          { label: '오늘 유입', value: todayLeads, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} variant="glass" className="p-4 text-center">
            {loading ? <Skeleton className="h-7 w-12 mx-auto mb-1" /> : (
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* 캠페인 카드 목록 */}
      <div className="space-y-2">
        {loading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          : filtered.length === 0
            ? (
              <Card variant="glass" className="p-12 text-center">
                <Megaphone size={32} className="text-muted-foreground/60 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {campaigns.length === 0 ? '진행 중인 캠페인이 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              </Card>
            )
            : filtered.map(c => (
              <button
                key={c.campaign}
                onClick={() => onSelect(c.campaign)}
                className="w-full p-4 text-left transition-all rounded-2xl hover:ring-1 hover:ring-brand-500/50 bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-[10px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center shrink-0">
                    <Megaphone size={18} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{c.campaign}</p>
                      <ChannelBadge channel={c.channel} />
                      {c.today_count > 0 && (
                        <Badge variant="success" className="text-[10px]">오늘 +{c.today_count}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-brand-400 font-semibold">{c.lead_count}건</span>
                      {c.landing_pages.length > 0 && (
                        <span className="flex items-center gap-1 truncate">
                          <FileText size={10} />
                          {c.landing_pages[0]}
                          {c.landing_pages.length > 1 && ` 외 ${c.landing_pages.length - 1}개`}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto shrink-0">
                        <Clock size={10} />
                        {timeAgo(c.latest_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" />
                </div>
              </button>
            ))
        }
      </div>
    </>
  )
}

// ─── 캠페인 상세 리드 목록 ───

function LeadCard({ lead, onStatusChange, onNotesChange }: {
  lead: CampaignLead
  onStatusChange: (id: number, status: string) => void
  onNotesChange: (id: number, notes: string) => void
}) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(lead.notes || '')
  const survey = lead.custom_data?.survey
  const surveyEntries = survey ? Object.values(survey) : []
  const marketingConsent = lead.custom_data?.marketing_consent
  const leadName = lead.custom_data?.name || lead.customer?.name || '이름 없음'
  const status = lead.lead_status || 'new'
  const statusConfig = LEAD_STATUS_CONFIG[status] || LEGACY_STATUS[status] || LEAD_STATUS_CONFIG.new

  const handleNotesSave = () => {
    onNotesChange(lead.id, notesValue)
    setEditingNotes(false)
  }

  return (
    <div
      className="px-4 py-3 rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-[10px]"
    >
      {/* 1행: 기본 정보 + 상태 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
          {leadName[0] || <User size={14} />}
        </div>
        <p className="text-sm font-semibold text-foreground shrink-0">{leadName}</p>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Phone size={10} />
          {lead.customer?.phone_number || '-'}
        </span>
        <ChannelBadge channel={lead.utm_source || '-'} />
        {marketingConsent !== undefined && (
          <span className={`flex items-center gap-1 text-[10px] shrink-0 ${marketingConsent ? 'text-emerald-500' : 'text-muted-foreground/60'}`}>
            <ShieldCheck size={10} />
            {marketingConsent ? '수신동의' : '미동의'}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-auto">
          {formatDateTime(lead.created_at)}
        </span>
        <Select value={status} onValueChange={v => onStatusChange(lead.id, v)}>
          <SelectTrigger className={`w-[100px] h-7 text-[11px] font-semibold border rounded-full px-2.5 ${statusConfig.color}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2행: 설문 응답 + 랜딩페이지 + 소재 */}
      <div className="flex items-center gap-1.5 pl-11 flex-wrap">
        {lead.landing_page && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
            {lead.landing_page.name}
          </span>
        )}
        {lead.utm_content && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted dark:bg-white/5 text-muted-foreground border border-border dark:border-white/10 shrink-0">
            {lead.utm_content}
          </span>
        )}
        {surveyEntries.length > 0 && (
          <>
            <span className="text-border text-[10px] mx-0.5">│</span>
            {surveyEntries.map((value, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-muted dark:bg-white/5 text-muted-foreground border border-border dark:border-white/10">
                {String(value)}
              </span>
            ))}
          </>
        )}
      </div>

      {/* 3행: 메모 */}
      <div className="pl-11 mt-2">
        {editingNotes ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNotesSave()}
              placeholder="메모 입력..."
              className="flex-1 text-xs bg-muted dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-3 py-1.5 text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-brand-500"
              autoFocus
            />
            <button onClick={handleNotesSave} className="text-[10px] text-brand-400 hover:text-brand-300 shrink-0">저장</button>
            <button onClick={() => { setEditingNotes(false); setNotesValue(lead.notes || '') }} className="text-[10px] text-muted-foreground hover:text-muted-foreground shrink-0">취소</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground/80 transition-colors"
          >
            <StickyNote size={10} />
            {lead.notes || '메모 추가...'}
          </button>
        )}
      </div>
    </div>
  )
}

const DETAIL_SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'name', label: '이름순' },
]

function CampaignDetail({ campaign, onBack }: { campaign: string; onBack: () => void }) {
  const { selectedClinicId } = useClinic()
  const [leads, setLeads] = useState<CampaignLead[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [channelFilter, setChannelFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  const fetchLeads = () => {
    setLoading(true)
    const params = new URLSearchParams({ campaign })
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    fetch(`/api/campaigns?${params}`)
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLeads() }, [campaign, selectedClinicId])

  // 필터링 + 정렬
  const filtered = useMemo(() => {
    let result = leads

    // 날짜 필터
    if (dateRange.from) {
      const from = startOfDay(dateRange.from).getTime()
      const to = dateRange.to ? endOfDay(dateRange.to).getTime() : endOfDay(dateRange.from).getTime()
      result = result.filter(l => {
        const ts = l.created_at.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(l.created_at) ? l.created_at : l.created_at + 'Z'
        const t = new Date(ts).getTime()
        return t >= from && t <= to
      })
    }

    // 이름/전화번호 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(l => {
        const name = (l.custom_data?.name || l.customer?.name || '').toLowerCase()
        const phone = l.customer?.phone_number || ''
        return name.includes(q) || phone.includes(q)
      })
    }

    // 채널 필터
    if (channelFilter !== 'all') {
      result = result.filter(l => normalizeChannel(l.utm_source || '') === channelFilter)
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(l => (l.lead_status || 'new') === statusFilter)
    }

    // 정렬
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name': {
          const nameA = a.custom_data?.name || a.customer?.name || ''
          const nameB = b.custom_data?.name || b.customer?.name || ''
          return nameA.localeCompare(nameB, 'ko')
        }
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [leads, dateRange, search, channelFilter, statusFilter, sortBy])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / LEADS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * LEADS_PER_PAGE, safePage * LEADS_PER_PAGE)

  // 필터 변경 시 1페이지로 리셋
  useEffect(() => { setPage(1) }, [search, dateRange, channelFilter, statusFilter, sortBy])

  // 상태 배지용 카운트 (상태 필터 제외, 나머지 필터 적용)
  const filteredForStatus = useMemo(() => {
    let result = leads
    if (dateRange.from) {
      const from = startOfDay(dateRange.from).getTime()
      const to = dateRange.to ? endOfDay(dateRange.to).getTime() : endOfDay(dateRange.from).getTime()
      result = result.filter(l => {
        const ts = l.created_at.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(l.created_at) ? l.created_at : l.created_at + 'Z'
        const t = new Date(ts).getTime()
        return t >= from && t <= to
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(l => {
        const name = (l.custom_data?.name || l.customer?.name || '').toLowerCase()
        const phone = l.customer?.phone_number || ''
        return name.includes(q) || phone.includes(q)
      })
    }
    if (channelFilter !== 'all') {
      result = result.filter(l => normalizeChannel(l.utm_source || '') === channelFilter)
    }
    return result
  }, [leads, dateRange, search, channelFilter])

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    const params = new URLSearchParams()
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    const res = await fetch(`/api/leads/${leadId}?${params}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_status: newStatus }),
    })
    if (res.ok) {
      const statusLabel = LEAD_STATUS_CONFIG[newStatus]?.label || newStatus
      if (newStatus === 'booked') {
        toast.success(`상태가 '${statusLabel}'(으)로 변경되었습니다. 예약/결제 관리 페이지에 자동 등록되었습니다.`)
      } else {
        toast.success(`상태가 '${statusLabel}'(으)로 변경되었습니다.`)
      }
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lead_status: newStatus } : l))
    } else {
      toast.error('상태 변경 실패')
    }
  }

  const handleNotesChange = async (leadId: number, notes: string) => {
    const params = new URLSearchParams()
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    const res = await fetch(`/api/leads/${leadId}?${params}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) {
      toast.success('메모가 저장되었습니다.')
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes } : l))
    } else {
      toast.error('메모 저장 실패')
    }
  }

  const activeFilterCount = (search ? 1 : 0) + (dateRange.from ? 1 : 0) + (channelFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (sortBy !== 'newest' ? 1 : 0)

  // 캠페인 내 채널 목록 (동적)
  const availableChannels = useMemo(() => {
    const chSet = new Set<string>()
    leads.forEach(l => {
      const ch = normalizeChannel(l.utm_source || '')
      if (ch !== 'Unknown') chSet.add(ch)
    })
    return Array.from(chSet).sort()
  }, [leads])

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={14} /> 캠페인 목록
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
            <Megaphone size={18} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{campaign}</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? '로딩 중...' : `${leads.length}건의 리드`}
            </p>
          </div>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Card variant="glass" className="flex items-center px-3 py-1.5 flex-1 max-w-xs min-w-[180px]">
          <Search size={14} className="text-muted-foreground mr-2 shrink-0" />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호"
            className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 p-0 h-auto"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground shrink-0 ml-1 cursor-pointer">
              <X size={13} />
            </button>
          )}
        </Card>
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        {availableChannels.length > 1 && (
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-auto min-w-[110px] h-9 bg-card border-border dark:border-white/10 text-xs">
              <SelectValue>
                {channelFilter === 'all' ? '채널 전체' : channelFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">채널 전체</SelectItem>
              {availableChannels.map(ch => (
                <SelectItem key={ch} value={ch}>{ch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <SortSelect
          value={sortBy}
          onValueChange={setSortBy}
          options={DETAIL_SORT_OPTIONS}
        />
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(''); setDateRange({ from: undefined, to: undefined }); setChannelFilter('all'); setStatusFilter('all'); setSortBy('newest') }}
          >
            <X size={12} className="mr-1" />
            필터 초기화
          </Button>
        )}
      </div>

      {/* 상태 배지 요약 */}
      {!loading && leads.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
          {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => {
            const count = filteredForStatus.filter(l => (l.lead_status || 'new') === key).length
            return (
              <Card
                key={key}
                variant="glass"
                className={`p-2.5 text-center cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-brand-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${statusFilter === key ? 'ring-2 ring-brand-500/50 bg-brand-500/5' : ''}`}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(statusFilter === key ? 'all' : key) } }}
                aria-label={`${cfg.label}: ${count}건`}
                aria-pressed={statusFilter === key}
              >
                <p className={`text-lg font-bold ${statusFilter === key ? 'text-brand-400' : cfg.color.split(' ')[1]}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
              </Card>
            )
          })}
        </div>
      )}

      {/* 결과 건수 */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          총 {filtered.length}건{filtered.length > LEADS_PER_PAGE && ` 중 ${(safePage - 1) * LEADS_PER_PAGE + 1}~${Math.min(safePage * LEADS_PER_PAGE, filtered.length)}건 표시`}
        </p>
      )}

      {/* 리드 목록 */}
      <div className="space-y-2">
        {loading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : leads.length === 0
            ? (
              <Card variant="glass" className="p-8 text-center text-muted-foreground text-sm">
                이 캠페인에서 유입된 리드가 없습니다.
              </Card>
            )
            : filtered.length === 0
              ? (
                <Card variant="glass" className="p-8 text-center text-muted-foreground text-sm">
                  검색 결과가 없습니다.
                </Card>
              )
              : paged.map(lead => <LeadCard key={lead.id} lead={lead} onStatusChange={handleStatusChange} onNotesChange={handleNotesChange} />)
        }
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage(p => p - 1)}
            className="h-8 px-2 text-xs"
          >
            이전
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
              acc.push(p)
              return acc
            }, [])
            .map((item, i) =>
              item === 'ellipsis'
                ? <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">...</span>
                : (
                  <Button
                    key={item}
                    variant={safePage === item ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPage(item as number)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {item}
                  </Button>
                )
            )
          }
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="h-8 px-2 text-xs"
          >
            다음
          </Button>
        </div>
      )}
    </>
  )
}

// ─── 메인 ───

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-center py-12">로딩 중...</div>}>
      <CampaignsContent />
    </Suspense>
  )
}

function CampaignsContent() {
  const { selectedClinicId } = useClinic()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(
    searchParams.get('campaign')
  )

  const fetchCampaigns = () => {
    setLoading(true)
    const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
    fetch(`/api/campaigns${qs}`)
      .then(r => r.json())
      .then(d => setCampaigns(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCampaigns() }, [selectedClinicId])

  const handleSelect = (campaign: string) => {
    setSelectedCampaign(campaign)
    router.replace(`/campaigns?campaign=${encodeURIComponent(campaign)}`, { scroll: false })
  }

  const handleBack = () => {
    setSelectedCampaign(null)
    router.replace('/campaigns', { scroll: false })
  }

  if (selectedCampaign) {
    return <CampaignDetail campaign={selectedCampaign} onBack={handleBack} />
  }

  return (
    <CampaignList
      campaigns={campaigns}
      loading={loading}
      onSelect={handleSelect}
      onRefresh={fetchCampaigns}
    />
  )
}
