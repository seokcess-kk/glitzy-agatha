'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, User, Phone, Calendar, TrendingUp, Users, Filter, FileText, Info, X, Trash2, ArrowUpDown, Clock, Download } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useClinic } from '@/components/ClinicContext'
import { toast } from 'sonner'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PageHeader, ChannelBadge, CustomerJourney } from '@/components/common'
import { formatDate, toUtcDate } from '@/lib/date'

// 퍼널 단계 정의
type FunnelStage = 'lead' | 'booked' | 'visited' | 'consulted' | 'paid'
const FUNNEL_STAGES: Record<FunnelStage, { label: string; color: string; barColor: string }> = {
  lead: { label: '리드', color: 'bg-muted text-muted-foreground', barColor: 'bg-muted-foreground/30' },
  booked: { label: '예약', color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400', barColor: 'bg-blue-500' },
  visited: { label: '방문', color: 'bg-purple-500/20 text-purple-600 dark:text-purple-400', barColor: 'bg-purple-500' },
  consulted: { label: '상담', color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', barColor: 'bg-amber-500' },
  paid: { label: '결제', color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', barColor: 'bg-emerald-500' },
}

function getFunnelStage(customer: any): FunnelStage {
  if (customer?.payments?.length > 0) return 'paid'
  const hasConsultDone = customer?.consultations?.some((c: any) =>
    ['방문완료', '상담중', '시술확정'].includes(c.status)
  )
  if (hasConsultDone) return 'consulted'
  const hasVisited = customer?.bookings?.some((b: any) =>
    ['visited', 'treatment_confirmed'].includes(b.status)
  )
  if (hasVisited) return 'visited'
  const hasBooked = customer?.bookings?.some((b: any) =>
    b.status !== 'cancelled'
  )
  if (hasBooked) return 'booked'
  return 'lead'
}

const GRADE_CONFIG: Record<string, { color: string; icon: string }> = {
  VIP: { color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: '' },
  골드: { color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30', icon: '' },
  실버: { color: 'bg-muted text-foreground/60 border border-border', icon: '' },
  일반: { color: 'bg-muted/50 text-muted-foreground border border-border', icon: '' },
}

function getGrade(totalPayment: number, treatmentCount: number): keyof typeof GRADE_CONFIG {
  if (totalPayment >= 5_000_000 || treatmentCount >= 5) return 'VIP'
  if (totalPayment >= 2_000_000 || treatmentCount >= 3) return '골드'
  if (totalPayment >= 500_000 || treatmentCount >= 1) return '실버'
  return '일반'
}

function getCustomerType(customer: any): 'new' | 'revisit' {
  const total =
    (customer?.consultations?.length || 0) +
    (customer?.bookings?.length || 0) +
    (customer?.payments?.length || 0)
  return total >= 2 ? 'revisit' : 'new'
}

// 기간 필터 헬퍼
type DateRange = 'all' | 'today' | 'week' | 'month'
function isInDateRange(dateStr: string | undefined, range: DateRange): boolean {
  if (range === 'all' || !dateStr) return true
  const now = new Date()
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const target = toUtcDate(dateStr)
  const kstTarget = new Date(target.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))

  if (range === 'today') {
    return kstTarget.toDateString() === kstNow.toDateString()
  }
  if (range === 'week') {
    const weekAgo = new Date(kstNow)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return kstTarget >= weekAgo
  }
  if (range === 'month') {
    return kstTarget.getMonth() === kstNow.getMonth() && kstTarget.getFullYear() === kstNow.getFullYear()
  }
  return true
}

function CustomerDetail({ lead, onDelete, onClose, hideHeader }: { lead: any; onDelete?: (leadId: number) => void; onClose: () => void; hideHeader?: boolean }) {
  const c = lead.customer
  const payments: any[] = c?.payments || []
  const consultations: any[] = c?.consultations || []
  const bookings: any[] = c?.bookings || []
  const allLeads: any[] = lead.leads?.length ? lead.leads : [lead]
  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const grade = getGrade(totalPayment, payments.length)
  const gradeStyle = GRADE_CONFIG[grade]
  const customerType = getCustomerType(c)
  const funnelStage = getFunnelStage(c)
  const stageConfig = FUNNEL_STAGES[funnelStage]
  const leadCount = allLeads.length

  // 랜딩 페이지 및 설문 응답 정보
  const landingPage = lead.landing_page
  const customData = lead.custom_data

  const treatmentMap: Record<string, { count: number; total: number }> = {}
  payments.forEach((p: any) => {
    const name = p.treatment_name || '기타'
    if (!treatmentMap[name]) treatmentMap[name] = { count: 0, total: 0 }
    treatmentMap[name].count++
    treatmentMap[name].total += Number(p.payment_amount)
  })

  return (
    <div>
      {/* 닫기 버튼 (데스크탑 사이드 패널용) */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground">고객 상세</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
      )}

      {/* 고객 헤더 */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
          {c?.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <h3 className="font-semibold text-foreground text-sm">{c?.name || '이름 없음'}</h3>
            <ChannelBadge channel={c?.first_source || 'Unknown'} />
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${gradeStyle.color}`}>
              {grade}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={customerType === 'revisit' ? 'default' : 'secondary'} className={`text-[10px] ${customerType === 'revisit' ? 'bg-brand-500/20 text-brand-400 border-0' : ''}`}>
              {customerType === 'revisit' ? '재방문' : '신규'}
            </Badge>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stageConfig.color}`}>
              {stageConfig.label}
            </span>
            {leadCount > 1 && (
              <Badge variant="info" className="text-[10px]">{leadCount}회 유입</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><Phone size={10} />{c?.phone_number}</span>
            <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(lead.created_at)}</span>
          </div>
        </div>
      </div>

      {totalPayment > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
          <span className="text-xs text-muted-foreground">누적 결제액</span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">₩{totalPayment.toLocaleString()}</span>
        </div>
      )}

      {/* 랜딩 페이지 및 설문 응답 */}
      {(landingPage || (customData && Object.keys(customData).length > 0)) && (
        <div className="mb-4 p-3 bg-muted/40 dark:bg-white/[0.03] rounded-xl border border-border dark:border-white/5">
          {landingPage && (
            <div className="flex items-center gap-2 mb-2">
              <FileText size={11} className="text-brand-400" />
              <span className="text-[11px] font-semibold text-muted-foreground">유입 랜딩 페이지:</span>
              <span className="text-xs text-brand-400">{landingPage.name}</span>
            </div>
          )}
          {customData?.survey && Object.keys(customData.survey).length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Info size={11} /> 설문 응답
              </p>
              <div className="space-y-1">
                {Object.entries(customData.survey).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground/80">{String(value)}</span>
                  </div>
                ))}
              </div>
              {customData.marketing_consent !== undefined && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border dark:border-white/5">
                  마케팅 수신 동의: {customData.marketing_consent ? '동의' : '미동의'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 시술 이력 */}
      {Object.keys(treatmentMap).length > 0 && (
        <div className="mb-4 p-3 bg-muted/40 dark:bg-white/[0.03] rounded-xl border border-border dark:border-white/5">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp size={11} /> 시술 이력
          </p>
          <div className="space-y-1.5">
            {Object.entries(treatmentMap).map(([name, { count, total }]) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground/80">{name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted dark:bg-white/5 px-1.5 py-0.5 rounded-full">{count}회</span>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">₩{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border dark:border-white/5">
            <span className="text-[11px] text-muted-foreground">총 {payments.length}회 시술</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">₩{totalPayment.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 여정 타임라인 */}
      <CustomerJourney
        leads={allLeads}
        bookings={bookings}
        consultations={consultations}
        payments={payments}
      />

      {/* 삭제 버튼 (superadmin) */}
      {onDelete && (
        <div className="mt-4 pt-3 border-t border-border dark:border-white/5 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(lead.latest_lead?.id || lead.leads?.[0]?.id)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 size={14} /> 이 리드 삭제
          </Button>
        </div>
      )}
    </div>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-center py-12">로딩 중...</div>}>
      <LeadsContent />
    </Suspense>
  )
}

function LeadsContent() {
  const { selectedClinicId } = useClinic()
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'superadmin'
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'all' | 'new' | 'revisit'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'payment' | 'name'>('newest')
  const [landingPageFilter, setLandingPageFilter] = useState<string>(searchParams.get('landing_page_id') || 'all')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [landingPages, setLandingPages] = useState<{ id: number; name: string }[]>([])

  // 랜딩 페이지 목록 로드
  useEffect(() => {
    const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
    fetch(`/api/landing-pages${qs}`)
      .then(r => r.json())
      .then(d => setLandingPages(Array.isArray(d) ? d : []))
      .catch(() => { })
  }, [selectedClinicId])

  const fetchLeads = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    if (landingPageFilter !== 'all') params.set('landing_page_id', landingPageFilter)
    if (campaignFilter !== 'all') params.set('utm_campaign', campaignFilter)
    const qs = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/leads${qs}`)
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLeads() }, [selectedClinicId, landingPageFilter, campaignFilter])

  const [exporting, setExporting] = useState(false)
  const canExport = session?.user?.role === 'superadmin' || session?.user?.role === 'clinic_admin'
  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
      if (channelFilter !== 'all') params.set('channel', channelFilter)
      if (stageFilter !== 'all') {
        const label = FUNNEL_STAGES[stageFilter as FunnelStage]?.label
        if (label) params.set('stage', label)
      }
      if (landingPageFilter !== 'all') params.set('landing_page_id', landingPageFilter)
      if (campaignFilter !== 'all') params.set('utm_campaign', campaignFilter)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/leads/export${qs}`)
      if (!res.ok) throw new Error('내보내기에 실패했습니다.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'leads_export.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV 내보내기 완료')
    } catch (e: any) {
      toast.error(e.message || '내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('이 리드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('리드가 삭제되었습니다.')
      setSelected(null)
      fetchLeads()
    } catch (e: any) {
      toast.error(e.message || '삭제에 실패했습니다.')
    }
  }

  const channels = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => {
      const ch = l.utm_source || l.customer?.first_source
      if (ch) set.add(ch)
    })
    return Array.from(set).sort()
  }, [leads])

  const campaigns = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => {
      if (l.utm_campaign) set.add(l.utm_campaign)
      l.leads?.forEach((lead: any) => { if (lead.utm_campaign) set.add(lead.utm_campaign) })
    })
    return Array.from(set).sort()
  }, [leads])

  const activeFilterCount = [channelFilter, landingPageFilter, campaignFilter, stageFilter].filter(f => f !== 'all').length
    + (dateRange !== 'all' ? 1 : 0)

  // A: stageCounts는 필터 전 전체 leads 기준
  const allStageCounts = useMemo(() => {
    const counts: Record<FunnelStage, number> = { lead: 0, booked: 0, visited: 0, consulted: 0, paid: 0 }
    leads.forEach(l => {
      counts[getFunnelStage(l.customer)]++
    })
    return counts
  }, [leads])

  const totalLeads = leads.length

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search ||
        l.customer?.name?.includes(search) ||
        l.customer?.phone_number?.includes(search)
      if (!matchSearch) return false

      if (channelFilter !== 'all') {
        const ch = l.utm_source || l.customer?.first_source
        if (ch?.toLowerCase() !== channelFilter.toLowerCase()) return false
      }

      if (stageFilter !== 'all') {
        const stage = getFunnelStage(l.customer)
        if (stage !== stageFilter) return false
      }

      if (!isInDateRange(l.created_at, dateRange)) return false

      return true
    })
  }, [leads, search, channelFilter, stageFilter, dateRange])

  const newLeads = useMemo(() => filtered.filter(l => getCustomerType(l.customer) === 'new'), [filtered])
  const revisitLeads = useMemo(() => filtered.filter(l => getCustomerType(l.customer) === 'revisit'), [filtered])
  const displayed = useMemo(() => {
    const base = tab === 'all' ? filtered : tab === 'new' ? newLeads : revisitLeads
    // H: 정렬
    return [...base].sort((a, b) => {
      if (sortBy === 'payment') {
        const pa = (a.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
        const pb = (b.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
        return pb - pa
      }
      if (sortBy === 'name') {
        return (a.customer?.name || '').localeCompare(b.customer?.name || '', 'ko')
      }
      // newest (default)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
  }, [filtered, newLeads, revisitLeads, tab, sortBy])

  const TABS = [
    { key: 'all', label: '전체', count: filtered.length },
    { key: 'new', label: '신규고객', count: newLeads.length },
    { key: 'revisit', label: '재방문고객', count: revisitLeads.length },
  ]

  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all', label: '전체 기간' },
    { key: 'today', label: '오늘' },
    { key: 'week', label: '이번 주' },
    { key: 'month', label: '이번 달' },
  ]

  return (
    <>
      <PageHeader
        title="고객관리"
        description="광고 인입 → 상담 → 결제 전체 여정을 추적합니다."
        actions={
          <div className="flex items-center gap-2">
            {canExport && (
              <Button
                variant="glass"
                size="sm"
                onClick={handleExportCsv}
                disabled={exporting || loading}
                className="text-xs"
              >
                <Download size={13} />
                {exporting ? '내보내는 중...' : 'CSV 내보내기'}
              </Button>
            )}
            <Card variant="glass" className="flex items-center px-3 py-2">
              <Search size={14} className="text-muted-foreground mr-2" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름 또는 전화번호 검색"
                className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 w-52 p-0 h-auto"
              />
            </Card>
          </div>
        }
      />

      {/* A+E: 퍼널 단계 요약 — 항상 전체 기준 count + 진행 바 */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {(Object.entries(FUNNEL_STAGES) as [FunnelStage, typeof FUNNEL_STAGES[FunnelStage]][]).map(([key, stage]) => {
          const count = allStageCounts[key]
          const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
          return (
            <button
              key={key}
              onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
              className={`p-3 text-center transition-all rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-md ${stageFilter === key ? 'ring-2 ring-brand-500 bg-brand-500/5' : 'hover:bg-muted dark:hover:bg-white/[0.03]'}`}
              aria-pressed={stageFilter === key}
              aria-label={`${stage.label} 필터 ${stageFilter === key ? '해제' : '적용'}`}
            >
              {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : (
                <p className={`text-lg font-bold ${stageFilter === key ? 'text-brand-400' : 'text-foreground'}`}>{count}</p>
              )}
              <p className="text-[11px] text-muted-foreground mb-1.5">{stage.label}</p>
              {/* E: 진행 바 */}
              <div className="h-1 bg-muted dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${stage.barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* 필터 + 탭 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-2">
          {TABS.map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'glass'}
              onClick={() => { setTab(t.key as typeof tab); setSelected(null) }}
              className={tab === t.key ? 'bg-brand-600 border-brand-600' : ''}
            >
              {t.key === 'new' && <User size={13} />}
              {t.key === 'revisit' && <Users size={13} />}
              {t.label}
              <span className={`text-xs px-1.5 py-0 rounded-full ml-1 ${tab === t.key ? 'bg-white/20' : 'bg-muted dark:bg-white/5 text-muted-foreground'}`}>
                {t.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* G: 기간 필터 */}
          <div className="flex gap-1 bg-muted dark:bg-white/5 rounded-lg p-0.5">
            {DATE_RANGES.map(d => (
              <Button
                key={d.key}
                variant={dateRange === d.key ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs px-2.5 h-7 ${dateRange === d.key ? 'bg-brand-600 hover:bg-brand-700' : ''}`}
                onClick={() => setDateRange(d.key)}
              >
                {d.label}
              </Button>
            ))}
          </div>

          <Filter size={14} className="text-muted-foreground" />

          {channels.length > 0 && (
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[130px] glass-card border-0 text-foreground text-xs">
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

          {landingPages.length > 0 && (
            <Select value={landingPageFilter} onValueChange={v => { setLandingPageFilter(v); setSelected(null) }}>
              <SelectTrigger className="w-[150px] glass-card border-0 text-foreground text-xs">
                <SelectValue placeholder="전체 랜딩페이지" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 랜딩페이지</SelectItem>
                {landingPages.map(lp => (
                  <SelectItem key={lp.id} value={String(lp.id)}>{lp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {campaigns.length > 0 && (
            <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setSelected(null) }}>
              <SelectTrigger className="w-[150px] glass-card border-0 text-foreground text-xs">
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

          {/* H: 정렬 */}
          <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[110px] glass-card border-0 text-foreground text-xs">
              <ArrowUpDown size={11} className="mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">최신순</SelectItem>
              <SelectItem value="payment">결제액순</SelectItem>
              <SelectItem value="name">이름순</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setLandingPageFilter('all'); setCampaignFilter('all'); setChannelFilter('all'); setDateRange('all'); setStageFilter('all') }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={12} /> 초기화
            </Button>
          )}
        </div>
      </div>

      {/* 모바일 Sheet */}
      <div className="md:hidden">
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>고객 상세</SheetTitle>
            </SheetHeader>
            {selected && <CustomerDetail lead={selected} onDelete={isSuperAdmin ? handleDeleteLead : undefined} onClose={() => setSelected(null)} hideHeader />}
          </SheetContent>
        </Sheet>
      </div>

      {/* B: 목록 전체 너비 + 우측 사이드 패널 */}
      <div className="hidden md:flex gap-3">
        {/* 고객 목록 */}
        <div className="flex-1 min-w-0 space-y-2">
          {loading
            ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
            : displayed.map(lead => {
              const c = lead.customer
              const payments: any[] = c?.payments || []
              const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
              const grade = getGrade(totalPayment, payments.length)
              const gradeStyle = GRADE_CONFIG[grade]
              const isSelected = selected?.id === lead.id
              const funnelStage = getFunnelStage(c)
              const stageConfig = FUNNEL_STAGES[funnelStage]
              const channelSource = lead.utm_source || c?.first_source
              const leadCount = lead.lead_count || 1
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelected(isSelected ? null : lead)}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-md ${isSelected ? 'ring-1 ring-brand-500 bg-brand-500/5' : 'hover:bg-muted dark:hover:bg-white/[0.03]'}`}
                  aria-pressed={isSelected}
                  aria-label={`${c?.name || '이름 없음'} 고객 ${isSelected ? '선택 해제' : '선택'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0 relative">
                    {c?.name?.[0] || <User size={14} />}
                    {leadCount > 1 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {leadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{c?.name || '이름 없음'}</p>
                      {grade !== '일반' && (
                        <span className={`text-[10px] font-bold px-1.5 rounded-full shrink-0 ${gradeStyle.color}`}>
                          {grade}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 rounded-full shrink-0 ${stageConfig.color}`}>
                        {stageConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{c?.phone_number}</span>
                      {/* I: 유입일 표시 */}
                      <span className="flex items-center gap-0.5 text-muted-foreground/60 shrink-0">
                        <Clock size={9} />{formatDate(lead.created_at)}
                      </span>
                      {lead.utm_campaign && (
                        <span className="text-muted-foreground/60 truncate">· {lead.utm_campaign}</span>
                      )}
                      {leadCount > 1 && (
                        <span className="text-brand-400 shrink-0">({leadCount}회)</span>
                      )}
                    </div>
                  </div>
                  {totalPayment > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">₩{totalPayment.toLocaleString()}</span>
                  )}
                  <ChannelBadge channel={channelSource || '-'} />
                </button>
              )
            })
          }
          {!loading && displayed.length === 0 && (
            <Card variant="glass" className="p-8 text-center text-muted-foreground text-sm">
              {search
                ? `'${search}' 검색 결과 없음`
                : tab === 'revisit' ? '재방문 고객이 없습니다.'
                  : tab === 'new' ? '신규 고객이 없습니다.'
                    : '인입된 고객이 없습니다.'}
            </Card>
          )}
        </div>

        {/* B: 우측 사이드 패널 */}
        {selected && (
          <Card variant="glass" className="w-[400px] shrink-0 p-5 self-start sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <CustomerDetail lead={selected} onDelete={isSuperAdmin ? handleDeleteLead : undefined} onClose={() => setSelected(null)} />
          </Card>
        )}
      </div>

      {/* 모바일 목록 */}
      <div className="md:hidden space-y-2">
        {loading
          ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : displayed.map(lead => {
            const c = lead.customer
            const funnelStage = getFunnelStage(c)
            const stageConfig = FUNNEL_STAGES[funnelStage]
            const channelSource = lead.utm_source || c?.first_source
            const leadCount = lead.lead_count || 1
            const isSelected = selected?.id === lead.id
            return (
              <button
                key={lead.id}
                onClick={() => setSelected(isSelected ? null : lead)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-md ${isSelected ? 'ring-1 ring-brand-500' : 'hover:bg-muted dark:hover:bg-white/[0.03]'}`}
              >
                <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0 relative">
                  {c?.name?.[0] || <User size={14} />}
                  {leadCount > 1 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {leadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-medium text-foreground truncate">{c?.name || '이름 없음'}</p>
                    <span className={`text-[10px] px-1.5 rounded-full shrink-0 ${stageConfig.color}`}>
                      {stageConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{c?.phone_number}</span>
                    <span className="flex items-center gap-0.5 text-muted-foreground/60 shrink-0">
                      <Clock size={9} />{formatDate(lead.created_at)}
                    </span>
                  </div>
                </div>
                <ChannelBadge channel={channelSource || '-'} />
              </button>
            )
          })
        }
        {!loading && displayed.length === 0 && (
          <Card variant="glass" className="p-8 text-center text-muted-foreground text-sm">
            {search ? `'${search}' 검색 결과 없음` : '인입된 고객이 없습니다.'}
          </Card>
        )}
      </div>
    </>
  )
}
