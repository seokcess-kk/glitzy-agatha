'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Plus, Trash2, Eye, Heart, MessageCircle, Share2, Bookmark, ExternalLink, Check, AlertCircle, X, Search } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from '@/components/charts'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, StatsCard, ConfirmDialog } from '@/components/common'
import { formatDate } from '@/lib/date'

// ─── 상수 ─────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; variant: "meta" | "google" | "tiktok" | "naver" | "secondary"; hasApi: boolean; statFields: string[]; chartColor: string }> = {
  youtube:          { label: '유튜브',        variant: 'google',    hasApi: true,  statFields: ['views', 'likes', 'comments'],          chartColor: '#ef4444' },
  instagram_feed:   { label: '인스타 피드',   variant: 'meta',      hasApi: true,  statFields: ['likes', 'comments', 'saves', 'reach'], chartColor: '#ec4899' },
  instagram_reels:  { label: '인스타 릴스',   variant: 'meta',      hasApi: true,  statFields: ['views', 'likes', 'comments', 'shares'], chartColor: '#a855f7' },
  tiktok:           { label: '틱톡',          variant: 'tiktok',    hasApi: false, statFields: ['views', 'likes', 'comments', 'shares'], chartColor: '#64748b' },
  naver_blog:       { label: '네이버 블로그', variant: 'naver',     hasApi: false, statFields: ['views', 'likes', 'comments'],          chartColor: '#22c55e' },
}

const STAT_LABEL: Record<string, string> = {
  views: '조회수', likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장', reach: '도달', impressions: '노출',
}

// 폼 필드 타입 (통계 필드 포함)
type StatField = 'views' | 'likes' | 'comments' | 'shares' | 'saves'
type UtmField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'

interface ContentForm {
  platform: string
  title: string
  url: string
  published_at: string
  thumbnail_url: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  utm_term: string
  budget: string
  views: string
  likes: string
  comments: string
  shares: string
  saves: string
}

const INITIAL_FORM: ContentForm = {
  platform: 'youtube', title: '', url: '', published_at: '', thumbnail_url: '',
  utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '',
  budget: '', views: '', likes: '', comments: '', shares: '', saves: '',
}

// ─── 콘텐츠 추가 모달 ─────────────────────────────────────
function AddContentModal({ open, onClose, onSaved, clinicId }: { open: boolean; onClose: () => void; onSaved: () => void; clinicId: number | null }) {
  const [form, setForm] = useState<ContentForm>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.title || !form.platform) return
    setSaving(true)
    try {
      const qs = clinicId ? `?clinic_id=${clinicId}` : ''
      const res = await fetch(`/api/content/posts${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: Number(form.budget) || 0,
          views: Number(form.views) || 0,
          likes: Number(form.likes) || 0,
          comments: Number(form.comments) || 0,
          shares: Number(form.shares) || 0,
          saves: Number(form.saves) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
      toast.success('콘텐츠가 추가되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const platCfg = PLATFORM_CONFIG[form.platform]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>콘텐츠 수기 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">플랫폼 *</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                <Button
                  key={key}
                  variant={form.platform === key ? 'default' : 'glass'}
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, platform: key }))}
                  className={form.platform === key ? 'bg-brand-600' : ''}
                >
                  {cfg.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">제목 *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="콘텐츠 제목"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
              <Input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">발행일</Label>
              <Input
                type="date"
                value={form.published_at}
                onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">예산 (₩)</Label>
              <Input
                type="number"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">현재 통계</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {platCfg?.statFields.map(field => {
                const statField = field as StatField
                return (
                  <div key={field}>
                    <Label className="text-[10px] text-muted-foreground/60 mb-1 block">{STAT_LABEL[field]}</Label>
                    <Input
                      type="number"
                      value={form[statField]}
                      onChange={e => setForm(f => ({ ...f, [statField]: e.target.value }))}
                      placeholder="0"
                      min="0"
                      className="h-8 text-sm"
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <details>
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground/80">UTM 파라미터 (선택)</summary>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {([['utm_source', 'Source'], ['utm_medium', 'Medium'], ['utm_campaign', 'Campaign'], ['utm_content', 'Content'], ['utm_term', 'Term']] as const).map(([key, label]) => {
                const utmField = key as UtmField
                return (
                  <div key={key}>
                    <Label className="text-[10px] text-muted-foreground/60 mb-1 block">{label}</Label>
                    <Input
                      value={form[utmField]}
                      onChange={e => setForm(f => ({ ...f, [utmField]: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                )
              })}
            </div>
          </details>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border dark:border-white/5">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={saving || !form.title}>
            {saving ? '저장 중...' : '추가'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── 통계 + 예산 수기 수정 ────────────────────────────────
function StatEditRow({ post, onSaved }: { post: any; onSaved: () => void }) {
  const platCfg = PLATFORM_CONFIG[post.platform]
  const latestStat = (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}
  const [form, setForm] = useState<Record<string, number>>({
    views: latestStat.views || 0, likes: latestStat.likes || 0,
    comments: latestStat.comments || 0, shares: latestStat.shares || 0, saves: latestStat.saves || 0,
  })
  const [budget, setBudget] = useState(post.budget || 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await Promise.all([
      fetch('/api/content/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: post.id, ...form }) }),
      fetch('/api/content/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, budget }) }),
    ])
    setSaving(false)
    onSaved()
    toast.success('업데이트되었습니다.')
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-end gap-2">
        {platCfg?.statFields.map(field => (
          <div key={field} className="flex-1">
            <Label className="text-[10px] text-muted-foreground mb-1 block">{STAT_LABEL[field]}</Label>
            <Input
              type="number"
              value={form[field] || 0}
              onChange={e => setForm(f => ({ ...f, [field]: Number(e.target.value) }))}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-[10px] text-muted-foreground mb-1 block">예산 (₩)</Label>
          <Input
            type="number"
            value={budget}
            onChange={e => setBudget(Number(e.target.value))}
            min="0"
            placeholder="제작비 / 운영 예산"
            className="h-8 text-xs border-amber-500/20 focus:border-amber-500"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? '저장' : '업데이트'}
        </Button>
      </div>
    </div>
  )
}

// ─── 콘텐츠 테이블 행 ─────────────────────────────────────
function ContentRow({ post, onDelete, onRefresh }: { post: any; onDelete: (id: number) => void; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const platCfg = PLATFORM_CONFIG[post.platform] || { label: post.platform, variant: 'secondary' as const, statFields: [], hasApi: false, chartColor: '#64748b' }
  const latestStat = (post.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}
  const engagement = (latestStat.likes || 0) + (latestStat.comments || 0) + (latestStat.shares || 0) + (latestStat.saves || 0)

  return (
    <>
      <TableRow>
        <TableCell>
          <Badge variant={platCfg.variant}>{platCfg.label}</Badge>
        </TableCell>
        <TableCell className="max-w-[280px]">
          <p className="text-foreground text-sm font-medium truncate">{post.title}</p>
          {post.utm_campaign && <span className="text-[10px] text-brand-400">{post.utm_campaign}</span>}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          {post.published_at ? formatDate(post.published_at) : '-'}
        </TableCell>
        <TableCell className="text-foreground/80 text-xs text-right">
          {latestStat.views > 0 ? latestStat.views.toLocaleString() : <span className="text-muted-foreground/60">-</span>}
        </TableCell>
        <TableCell className="text-foreground/80 text-xs text-right">
          {engagement > 0 ? engagement.toLocaleString() : <span className="text-muted-foreground/60">-</span>}
        </TableCell>
        <TableCell className="text-xs text-right">
          {post.budget > 0
            ? <span className="text-amber-400 font-medium">₩{Number(post.budget).toLocaleString()}</span>
            : <span className="text-muted-foreground/60">-</span>}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {post.url && (
              <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                <a href={post.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} />
                </a>
              </Button>
            )}
            <Button variant="glass" size="sm" onClick={() => setExpanded(v => !v)} className="text-xs h-7">
              {expanded ? '닫기' : '수정'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(post.id)} className="h-7 w-7 text-muted-foreground/60 hover:text-red-400">
              <Trash2 size={13} />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/30 dark:bg-white/[0.02]">
          <TableCell colSpan={7} className="px-4 pt-2 pb-4">
            <StatEditRow post={post} onSaved={() => { setExpanded(false); onRefresh() }} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function ContentPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  const { selectedClinicId } = useClinic()
  const [posts, setPosts] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'campaign' | 'month' | 'post'>('campaign')
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const [postsRes, analyticsRes] = await Promise.allSettled([
        fetch(`/api/content/posts?${qs}`).then(r => r.json()),
        fetch(`/api/content/analytics?groupBy=platform${selectedClinicId ? `&clinic_id=${selectedClinicId}` : ''}`).then(r => r.json()),
      ])
      if (postsRes.status === 'fulfilled') setPosts(Array.isArray(postsRes.value) ? postsRes.value : [])
      if (analyticsRes.status === 'fulfilled') setAnalytics(Array.isArray(analyticsRes.value) ? analyticsRes.value : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  const [detailAnalytics, setDetailAnalytics] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchDetailAnalytics = useCallback(async () => {
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({ groupBy })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const res = await fetch(`/api/content/analytics?${qs}`)
      const json = await res.json()
      setDetailAnalytics(Array.isArray(json) ? json : [])
    } finally {
      setDetailLoading(false)
    }
  }, [groupBy, selectedClinicId])

  useEffect(() => { fetchPosts() }, [fetchPosts])
  useEffect(() => { fetchDetailAnalytics() }, [fetchDetailAnalytics])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/content/sync${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'all' }) })
      const data = await res.json()
      if (data.success) {
        toast.success('API 동기화 완료')
        fetchPosts()
      } else {
        toast.error(data.message || '동기화 실패')
      }
    } catch {
      toast.error('동기화 요청 실패')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    await fetch('/api/content/posts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteTarget }) })
    fetchPosts()
    toast.success('콘텐츠가 삭제되었습니다.')
    setDeleteTarget(null)
  }

  const getLatestStat = (p: any) => (p.stats || []).sort((a: any, b: any) => b.stat_date?.localeCompare(a.stat_date))[0] || {}

  // 상단 KPI 집계
  const allPosts = platformFilter === 'all' ? posts : posts.filter(p => p.platform === platformFilter)
  const totalViews = allPosts.reduce((s, p) => s + (getLatestStat(p).views || 0), 0)
  const totalEngagement = allPosts.reduce((s, p) => { const st = getLatestStat(p); return s + (st.likes || 0) + (st.comments || 0) + (st.shares || 0) + (st.saves || 0) }, 0)
  const filteredAnalytics = platformFilter === 'all' ? analytics : analytics.filter(a => a.key === platformFilter)
  const totalBudget = filteredAnalytics.reduce((s, a) => s + (a.budget || 0), 0)
  const totalLeads = filteredAnalytics.reduce((s, a) => s + (a.leads || 0), 0)
  const totalRevenue = filteredAnalytics.reduce((s, a) => s + (a.revenue || 0), 0)
  const overallCpl = totalLeads > 0 && totalBudget > 0 ? Math.round(totalBudget / totalLeads) : 0
  const overallRoas = totalBudget > 0 ? Math.round((totalRevenue / totalBudget) * 100) : 0

  // 차트 데이터 (플랫폼별 CPL/ROAS)
  const cplChartData = analytics.filter(a => a.cpl > 0)
  const roasChartData = analytics.filter(a => a.roas > 0)

  // 콘텐츠 목록 필터
  const filteredPosts = posts
    .filter(p => platformFilter === 'all' || p.platform === platformFilter)
    .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="삭제 확인"
        description="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={confirmDelete}
      />
      <AddContentModal open={showAddModal} onClose={() => setShowAddModal(false)} onSaved={fetchPosts} clinicId={selectedClinicId} />

      {/* 헤더 */}
      <PageHeader
        title="브랜드 콘텐츠 분석"
        description="유튜브 · 인스타그램 · 틱톡 · 네이버 블로그 콘텐츠 성과 통합 관리"
        actions={
          <>
            <Button variant="glass" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'API 동기화 중...' : 'API 동기화'}
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> 콘텐츠 추가
            </Button>
          </>
        }
      />

      {/* 플랫폼 필터 — 전체 페이지에 적용 */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <Button
          variant={platformFilter === 'all' ? 'default' : 'glass'}
          size="sm"
          onClick={() => setPlatformFilter('all')}
          className={platformFilter === 'all' ? 'bg-brand-600' : ''}
        >
          전체 <span className="ml-1 opacity-60">{posts.length}</span>
        </Button>
        {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => {
          const count = posts.filter(p => p.platform === key).length
          return (
            <Button
              key={key}
              variant={platformFilter === key ? 'default' : 'glass'}
              size="sm"
              onClick={() => setPlatformFilter(key)}
              className={platformFilter === key ? 'bg-brand-600' : ''}
            >
              {cfg.label} <span className="ml-1 opacity-60">{count}</span>
            </Button>
          )
        })}
      </div>

      {/* ── 대시보드 영역 ── */}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        {[
          { label: '총 조회수',    value: totalViews.toLocaleString(),                                                    color: 'text-foreground' },
          { label: '총 참여수',    value: totalEngagement.toLocaleString(),                                               color: 'text-foreground' },
          { label: '총 예산',      value: totalBudget > 0 ? `₩${totalBudget.toLocaleString()}` : '-',                    color: 'text-amber-400' },
          { label: 'DB 유입',      value: totalLeads > 0 ? `${totalLeads}건` : '-',                                      color: 'text-blue-400' },
          { label: '총 결제 금액', value: totalRevenue > 0 ? `₩${totalRevenue.toLocaleString()}` : '-',                  color: 'text-emerald-400' },
          { label: 'CPL',          value: overallCpl > 0 ? `₩${overallCpl.toLocaleString()}` : '-',                     color: 'text-foreground' },
          { label: 'ROAS',         value: overallRoas > 0 ? `${overallRoas}%` : '-',                                    color: overallRoas >= 100 ? 'text-emerald-400' : overallRoas > 0 ? 'text-red-400' : 'text-muted-foreground' },
        ].map(({ label, value, color }) => (
          <Card key={label} variant="glass" className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 leading-tight">{label}</p>
            {loading ? <Skeleton className="h-6 w-16" /> : <p className={`text-lg font-bold ${color}`}>{value}</p>}
          </Card>
        ))}
      </div>

      {/* CPL / ROAS 차트 */}
      {(cplChartData.length > 0 || roasChartData.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Card variant="glass" className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">플랫폼별 CPL</h3>
            <p className="text-xs text-muted-foreground mb-4">DB 1건 획득 비용</p>
            {cplChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cplChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `₩${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`₩${Number(v).toLocaleString()}`, 'CPL']} />
                  <Bar dataKey="cpl" radius={[4, 4, 0, 0]}>
                    {cplChartData.map((entry, i) => (
                      <Cell key={i} fill={PLATFORM_CONFIG[entry.key]?.chartColor || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-muted-foreground/60 text-xs">예산 입력 후 표시</div>}
          </Card>
          <Card variant="glass" className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">플랫폼별 ROAS</h3>
            <p className="text-xs text-muted-foreground mb-4">예산 대비 매출 (100% 이상 = 흑자)</p>
            {roasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={roasChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`${v}%`, 'ROAS']} />
                  <Bar dataKey="roas" radius={[4, 4, 0, 0]}>
                    {roasChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.roas >= 100 ? (PLATFORM_CONFIG[entry.key]?.chartColor || '#10b981') : '#ef4444'} fillOpacity={entry.roas >= 100 ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-muted-foreground/60 text-xs">예산 입력 후 표시</div>}
          </Card>
        </div>
      )}

      {/* 분석 상세 테이블 */}
      <Card variant="glass" className="mb-5 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-white/5">
          <h3 className="text-sm font-semibold text-foreground">상세 분석</h3>
          <div className="flex gap-1">
            {([['campaign', '캠페인별'], ['month', '월별'], ['post', '콘텐츠별']] as const).map(([val, label]) => (
              <Button
                key={val}
                variant={groupBy === val ? 'default' : 'glass'}
                size="sm"
                onClick={() => setGroupBy(val)}
                className={groupBy === val ? 'bg-brand-600' : ''}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {detailLoading ? (
          <div className="p-4 space-y-2">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : detailAnalytics.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">분석 데이터가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {['구분', '포스트', '예산', 'DB 유입', '결제 매출', 'CPL', 'ROAS'].map(h => (
                    <TableHead key={h} className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailAnalytics.map(row => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <p className="text-foreground text-xs font-medium truncate max-w-[200px]">{row.label}</p>
                      {row.platform && (
                        <Badge variant={PLATFORM_CONFIG[row.platform]?.variant || 'secondary'} className="mt-1 text-[10px]">
                          {PLATFORM_CONFIG[row.platform]?.label || row.platform}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.postCount}개</TableCell>
                    <TableCell className="text-xs">{row.budget > 0 ? <span className="text-amber-400 font-medium">₩{row.budget.toLocaleString()}</span> : <span className="text-muted-foreground/60">-</span>}</TableCell>
                    <TableCell className="text-xs">{row.leads > 0 ? <span className="text-blue-400">{row.leads}건</span> : <span className="text-muted-foreground/60">-</span>}</TableCell>
                    <TableCell className="text-xs">{row.revenue > 0 ? <span className="text-emerald-400">₩{row.revenue.toLocaleString()}</span> : <span className="text-muted-foreground/60">-</span>}</TableCell>
                    <TableCell className="text-xs">{row.cpl > 0 ? <span className="text-foreground font-semibold">₩{row.cpl.toLocaleString()}</span> : <span className="text-muted-foreground/60">-</span>}</TableCell>
                    <TableCell className="text-xs">{row.roas > 0 ? <span className={`font-semibold ${row.roas >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>{row.roas}%</span> : <span className="text-muted-foreground/60">-</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── 콘텐츠 목록 ── */}
      <Card variant="glass" className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-white/5">
          <h3 className="text-sm font-semibold text-foreground/80">콘텐츠 목록 <span className="text-muted-foreground font-normal">({filteredPosts.length})</span></h3>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="콘텐츠명 검색..."
              className="pl-8 w-52 h-8 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">{searchQuery ? '검색 결과가 없습니다.' : '콘텐츠 데이터가 없습니다.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">플랫폼</TableHead>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">제목 / UTM</TableHead>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">발행일</TableHead>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">조회수</TableHead>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">참여수</TableHead>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">예산</TableHead>
                  <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map(p => <ContentRow key={p.id} post={p} onDelete={handleDelete} onRefresh={fetchPosts} />)}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  )
}
