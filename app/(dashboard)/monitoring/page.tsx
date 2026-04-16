'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ChevronLeft, ChevronRight, ExternalLink, Pencil, Save, X, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { useClinic } from '@/components/ClinicContext'
import { PageHeader } from '@/components/common'

const CATEGORY_LABELS: Record<string, string> = {
  place: '네이버 플레이스',
  website: '웹사이트',
  smartblock: '스마트블록',
  related: '함께많이찾는',
}

const CATEGORY_LIST = ['place', 'website', 'smartblock', 'related']

function getRankColor(rank: number | null | undefined): string {
  if (rank == null) return ''
  if (rank <= 3) return 'bg-emerald-500/20 text-emerald-400'
  if (rank <= 10) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

function cellKey(keywordId: number, day: number): string {
  return `${keywordId}:${day}`
}

function parseCellKey(key: string): { keywordId: number; day: number } {
  const [kwIdStr, dayStr] = key.split(':')
  return { keywordId: parseInt(kwIdStr, 10), day: parseInt(dayStr, 10) }
}

function buildEditableCellOrder(keywords: any[], days: number[], isCurrentMonth: boolean, todayDay: number): string[] {
  const order: string[] = []
  for (const kw of keywords) {
    for (const d of days) {
      if (isCurrentMonth && d > todayDay) continue
      order.push(cellKey(kw.id, d))
    }
  }
  return order
}

export default function MonitoringPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user
  const { selectedClinicId, setSelectedClinicId, clinics } = useClinic()

  const [category, setCategory] = useState('all')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [keywords, setKeywords] = useState<any[]>([])
  const [rankings, setRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  // 인라인 순위 편집 상태
  const [editMode, setEditMode] = useState(false)
  const [editedCells, setEditedCells] = useState<Record<string, string>>({})
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 키워드 관리 상태
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({ keyword: '', category: 'place', url: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; keyword: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const canEdit = user?.role === 'superadmin' || user?.role === 'agency_staff' || user?.role === 'clinic_admin'

  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ month })
        if (category !== 'all') params.set('category', category)
        if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
        const res = await fetch(`/api/monitoring/rankings?${params}`)
        const data = await res.json()
        if (res.ok) {
          setKeywords(data.keywords || [])
          setRankings(data.rankings || [])
        } else {
          toast.error(data.error || '데이터 로드 실패')
        }
      } catch {
        toast.error('데이터 로드 실패')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [month, category, selectedClinicId, fetchKey])

  const refetch = useCallback(() => setFetchKey(k => k + 1), [])

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === mon
  const todayDay = today.getDate()

  // 순위 맵
  const rankMap = useMemo(() => {
    const map: Record<number, Record<number, { rank: number | null; url?: string }>> = {}
    for (const r of rankings) {
      const day = parseInt(r.rank_date.split('-')[2], 10)
      if (!map[r.keyword_id]) map[r.keyword_id] = {}
      map[r.keyword_id][day] = { rank: r.rank_position, url: r.url }
    }
    return map
  }, [rankings])

  // 요약 지표
  const summary = useMemo(() => {
    if (keywords.length === 0) return null
    let latestDay = 0
    for (const r of rankings) {
      const day = parseInt(r.rank_date.split('-')[2], 10)
      if (day > latestDay) latestDay = day
    }
    let top3Count = 0, top10Count = 0, totalRank = 0, rankedCount = 0
    for (const kw of keywords) {
      const rd = rankMap[kw.id]?.[latestDay]
      if (rd?.rank != null) {
        if (rd.rank <= 3) top3Count++
        if (rd.rank <= 10) top10Count++
        totalRank += rd.rank
        rankedCount++
      }
    }
    const allDays = rankings.map(r => parseInt(r.rank_date.split('-')[2], 10))
    const firstDay = allDays.length > 0 ? Math.min(...allDays) : latestDay
    let improvedCount = 0, declinedCount = 0
    for (const kw of keywords) {
      const first = rankMap[kw.id]?.[firstDay]?.rank
      const latest = rankMap[kw.id]?.[latestDay]?.rank
      if (first != null && latest != null) {
        if (latest < first) improvedCount++
        else if (latest > first) declinedCount++
      }
    }
    return { avgRank: rankedCount > 0 ? (totalRank / rankedCount).toFixed(1) : '-', top3Count, top10Count, totalKeywords: keywords.length, improvedCount, declinedCount, latestDay }
  }, [keywords, rankings, rankMap])

  // 순위 편집 기능
  const editableCellOrder = useMemo(
    () => buildEditableCellOrder(keywords, days, isCurrentMonth, todayDay),
    [keywords, days, isCurrentMonth, todayDay],
  )

  const toggleEditMode = useCallback(() => {
    if (editMode) { setEditedCells({}); setActiveCell(null) }
    setEditMode(prev => !prev)
  }, [editMode])

  const getCellValue = useCallback((keywordId: number, day: number): string => {
    const key = cellKey(keywordId, day)
    if (key in editedCells) return editedCells[key]
    const rank = rankMap[keywordId]?.[day]?.rank
    return rank != null ? String(rank) : ''
  }, [editedCells, rankMap])

  const handleCellClick = useCallback((keywordId: number, day: number) => {
    if (!editMode) return
    const key = cellKey(keywordId, day)
    setActiveCell(key)
    if (!(key in editedCells)) {
      const rank = rankMap[keywordId]?.[day]?.rank
      setEditedCells(prev => ({ ...prev, [key]: rank != null ? String(rank) : '' }))
    }
  }, [editMode, editedCells, rankMap])

  const handleCellChange = useCallback((key: string, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return
    setEditedCells(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleCellBlur = useCallback((keywordId: number, day: number) => {
    const key = cellKey(keywordId, day)
    const originalRank = rankMap[keywordId]?.[day]?.rank
    const originalStr = originalRank != null ? String(originalRank) : ''
    if (editedCells[key] === originalStr) {
      setEditedCells(prev => { const next = { ...prev }; delete next[key]; return next })
    }
    setActiveCell(null)
  }, [editedCells, rankMap])

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, keywordId: number, day: number) => {
    if (e.key === 'Escape') { e.currentTarget.blur(); return }
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      const currentKey = cellKey(keywordId, day)
      const currentIdx = editableCellOrder.indexOf(currentKey)
      if (currentIdx === -1) return
      const delta = e.shiftKey ? -1 : 1
      const nextIdx = currentIdx + delta
      if (nextIdx < 0 || nextIdx >= editableCellOrder.length) { e.currentTarget.blur(); return }
      const nextKey = editableCellOrder[nextIdx]
      const { keywordId: nextKwId, day: nextDay } = parseCellKey(nextKey)
      handleCellBlur(keywordId, day)
      handleCellClick(nextKwId, nextDay)
    }
  }, [editableCellOrder, handleCellBlur, handleCellClick])

  const changedCount = Object.keys(editedCells).length

  const handleSave = async () => {
    if (changedCount === 0) { toast.error('변경된 순위가 없습니다.'); return }
    const rankingsToSave = Object.entries(editedCells).map(([key, value]) => {
      const { keywordId, day } = parseCellKey(key)
      return { keyword_id: keywordId, rank_date: `${month}-${String(day).padStart(2, '0')}`, rank_position: value !== '' ? parseInt(value, 10) : null }
    })
    setSaving(true)
    try {
      const res = await fetch('/api/monitoring/rankings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rankings: rankingsToSave }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')
      toast.success(`${data.count}개 순위가 저장되었습니다.`)
      setEditedCells({}); setActiveCell(null); setEditMode(false); refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally { setSaving(false) }
  }

  // 키워드 관리 기능
  const handleAddKeyword = async () => {
    if (!addForm.keyword.trim()) { toast.error('키워드를 입력해주세요.'); return }
    if (!selectedClinicId) { toast.error('병원을 선택해주세요.'); return }
    setAddSaving(true)
    try {
      const res = await fetch('/api/monitoring/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_id: selectedClinicId, ...addForm }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddForm({ keyword: '', category: 'place', url: '' })
      setAddDialogOpen(false)
      toast.success('키워드가 등록되었습니다.')
      refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '등록 실패')
    } finally { setAddSaving(false) }
  }

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    if (togglingId !== null) return
    setTogglingId(id)
    try {
      const res = await fetch('/api/monitoring/keywords', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast.success(currentActive ? '비활성화되었습니다.' : '활성화되었습니다.')
      refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '변경 실패')
    } finally { setTogglingId(null) }
  }

  const handleDeleteKeyword = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/monitoring/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast.success('키워드가 삭제되었습니다.')
      refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '삭제 실패')
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  if (user?.role === 'clinic_staff') return null

  return (
    <>
      <PageHeader icon={TrendingUp} title="순위 모니터링" description="네이버 플레이스 · 웹사이트 · 스마트블록 순위 추적" />

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">병원</Label>
          <Select
            value={selectedClinicId ? String(selectedClinicId) : '_none'}
            onValueChange={v => setSelectedClinicId(v === '_none' ? null : Number(v))}
            disabled={editMode}
          >
            <SelectTrigger className="w-[200px] bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">전체 병원</SelectItem>
              {clinics.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">월</Label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-10 w-8" disabled={editMode}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-foreground font-medium min-w-[100px] text-center text-sm">{year}년 {mon}월</span>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-10 w-8" disabled={editMode}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">카테고리</Label>
          <div className="flex gap-1">
            <Button
              variant={category === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategory('all')}
              disabled={editMode}
              className={category === 'all' ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'text-muted-foreground hover:text-foreground'}
            >
              전체
            </Button>
            {CATEGORY_LIST.map(c => (
              <Button
                key={c}
                variant={category === c ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCategory(c)}
                disabled={editMode}
                className={category === c ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'text-muted-foreground hover:text-foreground'}
              >
                {CATEGORY_LABELS[c]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 액션 바 — canEdit && 병원 선택 시 */}
      {canEdit && selectedClinicId && !loading && (
        <div className="flex items-center gap-2 mb-6">
          {!editMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
              className="border-border dark:border-white/10 text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} className="mr-1" />키워드 추가
            </Button>
          )}
          {editMode && changedCount > 0 && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white">
              <Save size={14} className="mr-1" />
              {saving ? '저장 중...' : `저장 (${changedCount}건)`}
            </Button>
          )}
          {keywords.length > 0 && (
            <Button
              size="sm"
              variant={editMode ? 'outline' : 'default'}
              onClick={toggleEditMode}
              disabled={saving}
              className={editMode ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'bg-brand-600 hover:bg-brand-700 text-white'}
            >
              {editMode ? <><X size={14} className="mr-1" />편집 취소</> : <><Pencil size={14} className="mr-1" />순위 수정</>}
            </Button>
          )}
        </div>
      )}

      {/* 병원 미선택 + 키워드 있을 때 안내 */}
      {canEdit && !selectedClinicId && !loading && keywords.length > 0 && (
        <div className="mb-6 px-4 py-2.5 rounded-lg bg-muted/50 border border-border dark:border-white/10 text-xs text-muted-foreground">
          병원을 선택하면 순위 수정 및 키워드 관리를 할 수 있습니다.
        </div>
      )}

      {/* 키워드 추가 Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={open => { setAddDialogOpen(open); if (!open) setAddForm({ keyword: '', category: 'place', url: '' }) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키워드 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">키워드 *</Label>
              <Input
                value={addForm.keyword}
                onChange={e => setAddForm(f => ({ ...f, keyword: e.target.value }))}
                placeholder="검색 키워드 입력"
                onKeyDown={e => { if (e.key === 'Enter') handleAddKeyword() }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">카테고리 *</Label>
              <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="place">네이버 플레이스</SelectItem>
                  <SelectItem value="website">웹사이트</SelectItem>
                  <SelectItem value="smartblock">스마트블록</SelectItem>
                  <SelectItem value="related">함께많이찾는</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input
                value={addForm.url}
                onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com (선택)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>취소</Button>
            <Button onClick={handleAddKeyword} disabled={addSaving} className="bg-brand-600 hover:bg-brand-700">
              {addSaving ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 키워드 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>키워드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.keyword}&rdquo; 키워드를 삭제하시겠습니까?
              해당 키워드의 모든 순위 기록도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); handleDeleteKeyword() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <Card variant="glass" className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </Card>
      ) : keywords.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <p className="text-muted-foreground mb-4">등록된 키워드가 없습니다.</p>
          {canEdit && selectedClinicId && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)} className="bg-brand-600 hover:bg-brand-700">
              <Plus size={14} className="mr-1" />키워드 추가
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* 요약 카드 */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">평균 순위</p>
                <p className="text-3xl font-bold text-foreground">{summary.avgRank}<span className="text-base text-muted-foreground font-normal ml-0.5">위</span></p>
              </Card>
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">TOP 3</p>
                <p className="text-3xl font-bold text-emerald-400">{summary.top3Count}<span className="text-base text-muted-foreground font-normal ml-1">/ {summary.totalKeywords}</span></p>
              </Card>
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">TOP 10</p>
                <p className="text-3xl font-bold text-yellow-400">{summary.top10Count}<span className="text-base text-muted-foreground font-normal ml-1">/ {summary.totalKeywords}</span></p>
              </Card>
              <Card variant="glass" className="p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">월간 변동</p>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-emerald-400">{summary.improvedCount}</span>
                    <span className="text-xs text-muted-foreground ml-1">상승</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold text-red-400">{summary.declinedCount}</span>
                    <span className="text-xs text-muted-foreground ml-1">하락</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 편집 모드 안내 */}
          {editMode && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-brand-600/10 border border-brand-500/20 text-sm text-brand-400 flex items-center gap-2">
              <Pencil size={14} />
              <span>셀을 클릭하여 순위를 입력하세요. Tab/Enter로 다음 셀, 비우면 순위 삭제.</span>
              {changedCount > 0 && (
                <span className="ml-auto text-xs bg-brand-600/20 px-2 py-0.5 rounded-full font-medium">{changedCount}건 변경</span>
              )}
            </div>
          )}

          {/* 월간 순위 테이블 */}
          <Card variant="glass" className="p-4 mb-6 overflow-x-auto">
            <h3 className="text-sm font-semibold text-foreground mb-3">월간 순위 테이블</h3>
            <table className="w-full text-xs border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card text-left px-3 py-2.5 text-muted-foreground font-semibold border-b border-border dark:border-white/10 min-w-[140px] z-10">키워드</th>
                  <th className="sticky left-[140px] bg-card text-left px-2 py-2.5 text-muted-foreground font-semibold border-b border-border dark:border-white/10 min-w-[160px] z-10">URL</th>
                  {days.map(d => (
                    <th
                      key={d}
                      className={`text-center px-1 py-2 font-medium border-b border-border dark:border-white/10 min-w-[36px] ${
                        isCurrentMonth && d === todayDay ? 'text-brand-400' : isCurrentMonth && d > todayDay ? 'text-muted-foreground/40' : 'text-muted-foreground'
                      }`}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, kwIdx) => {
                  const prevCategory = kwIdx > 0 ? keywords[kwIdx - 1].category : null
                  const showCategoryHeader = category === 'all' && kw.category !== prevCategory
                  return (
                    <React.Fragment key={kw.id}>
                      {showCategoryHeader && (
                        <tr>
                          <td colSpan={days.length + 2} className="sticky left-0 bg-muted/50 dark:bg-card px-2 pt-4 pb-1 text-xs text-muted-foreground uppercase tracking-wider font-medium z-10">
                            {CATEGORY_LABELS[kw.category] || kw.category}
                          </td>
                        </tr>
                      )}
                      <tr className="group border-b border-border dark:border-white/5">
                        {/* 키워드 셀 + 행별 관리 아이콘 */}
                        <td className="sticky left-0 bg-card px-3 py-2.5 font-medium z-10">
                          <div className="flex items-center gap-1">
                            <span className={`truncate ${kw.is_active === false ? 'text-muted-foreground/60 line-through' : 'text-foreground/80'}`}>
                              {kw.keyword}
                            </span>
                            {kw.is_active === false && <span className="text-[10px] text-muted-foreground/60 shrink-0">(비활성)</span>}
                            {/* 행별 관리 아이콘 — hover 디바이스: hover 시 표시, 터치 디바이스: 항상 표시 */}
                            {canEdit && !editMode && (
                              <span className="ml-auto shrink-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => handleToggleActive(kw.id, kw.is_active)}
                                  disabled={togglingId !== null}
                                  className="p-1.5 rounded text-muted-foreground/50 hover:text-brand-400 hover:bg-brand-500/10 transition-colors disabled:opacity-30"
                                  title={kw.is_active ? '비활성화' : '활성화'}
                                >
                                  {kw.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  onClick={() => setDeleteTarget({ id: kw.id, keyword: kw.keyword })}
                                  className="p-1.5 rounded text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sticky left-[140px] bg-card px-2 py-2.5 z-10">
                          {kw.url ? (
                            <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-[11px] max-w-[150px] overflow-hidden">
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate">{kw.url.replace(/^https?:\/\//, '')}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px]">-</span>
                          )}
                        </td>
                        {days.map(d => {
                          const key = cellKey(kw.id, d)
                          const isEditing = editMode && activeCell === key
                          const isEdited = key in editedCells
                          const isFuture = isCurrentMonth && d > todayDay

                          if (editMode && !isFuture) {
                            const displayValue = getCellValue(kw.id, d)
                            const numValue = displayValue !== '' ? parseInt(displayValue, 10) : null
                            return (
                              <td key={d} className="text-center px-0.5 py-1 relative" onClick={() => handleCellClick(kw.id, d)}>
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    inputMode="numeric"
                                    value={editedCells[key] ?? ''}
                                    onChange={e => handleCellChange(key, e.target.value)}
                                    onBlur={() => handleCellBlur(kw.id, d)}
                                    onKeyDown={e => handleCellKeyDown(e, kw.id, d)}
                                    className="w-8 h-7 text-center text-[11px] font-bold bg-brand-600/20 border border-brand-500/50 rounded text-foreground outline-none focus:border-brand-400"
                                  />
                                ) : (
                                  <span
                                    className={`inline-flex items-center justify-center w-8 h-7 rounded text-[10px] font-bold cursor-pointer transition-all duration-200 ${
                                      isEdited
                                        ? `${getRankColor(numValue)} ring-1 ring-brand-400/50`
                                        : numValue != null
                                          ? `${getRankColor(numValue)} hover:ring-1 hover:ring-white/20`
                                          : 'text-muted-foreground/30 border border-dashed border-transparent hover:border-white/15 hover:text-muted-foreground/60 hover:bg-white/5'
                                    }`}
                                  >
                                    {numValue != null ? numValue : '-'}
                                  </span>
                                )}
                              </td>
                            )
                          }

                          const rd = rankMap[kw.id]?.[d]
                          const rank = rd?.rank
                          return (
                            <td key={d} className={`text-center px-1 py-2 ${isFuture ? 'opacity-20' : ''}`}>
                              {rank != null ? (
                                rd?.url ? (
                                  <a href={rd.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold ${getRankColor(rank)} cursor-pointer hover:opacity-80`}>{rank}</a>
                                ) : (
                                  <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold ${getRankColor(rank)}`}>{rank}</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/40">-</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* 편집 모드 하단 저장 바 */}
          {editMode && changedCount > 0 && (
            <div className="sticky bottom-4 z-20 flex justify-end">
              <div className="bg-card/95 backdrop-blur border border-border dark:border-white/10 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{changedCount}건 변경됨</span>
                <Button size="sm" variant="ghost" onClick={toggleEditMode} disabled={saving} className="text-muted-foreground hover:text-foreground">취소</Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white">
                  <Save size={14} className="mr-1" />{saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
