'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Newspaper, ExternalLink, Play, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { subDays, startOfDay } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { useClinic } from '@/components/ClinicContext'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { PageHeader, EmptyState } from '@/components/common'
import { toUtcDate, getKstDateString } from '@/lib/date'

interface PressKeyword {
  id: number
  clinic_id: number
  keyword: string
  is_active: boolean
}

function groupByDate(articles: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {}
  for (const a of articles) {
    const date = a.published_at
      ? toUtcDate(a.published_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })
      : '날짜 미상'
    if (!map[date]) map[date] = []
    map[date].push(a)
  }
  return map
}

export default function PressPage() {
  const { selectedClinicId } = useClinic()
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // 기간 필터 (기본: 최근 90일)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(startOfDay(new Date()), 90),
    to: startOfDay(new Date()),
  })

  // 키워드 상태
  const [keywords, setKeywords] = useState<PressKeyword[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [addingKeyword, setAddingKeyword] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PressKeyword | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 키워드 필터 탭
  const [activeKeywordId, setActiveKeywordId] = useState<number | null>(null)

  // 키워드 목록 로드
  const fetchKeywords = useCallback(async () => {
    if (!selectedClinicId) {
      setKeywords([])
      return
    }
    setKeywordsLoading(true)
    try {
      const res = await fetch(`/api/press/keywords?clinic_id=${selectedClinicId}`)
      const data = await res.json()
      setKeywords(Array.isArray(data) ? data : [])
    } catch {
      // silent
    } finally {
      setKeywordsLoading(false)
    }
  }, [selectedClinicId])

  // 기사 목록 로드
  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
      if (dateRange.from) params.set('from', getKstDateString(dateRange.from))
      if (dateRange.to) params.set('to', getKstDateString(dateRange.to))
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await fetch(`/api/press${qs}`).then(r => r.json())
      setArticles(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId, dateRange])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])
  useEffect(() => { fetchArticles() }, [fetchArticles])

  // 키워드 추가
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return
    if (!selectedClinicId) {
      toast.error('병원을 선택해주세요.')
      return
    }
    setAddingKeyword(true)
    try {
      const res = await fetch('/api/press/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_id: selectedClinicId, keyword: newKeyword.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setNewKeyword('')
      toast.success('키워드가 추가되었습니다.')
      fetchKeywords()
    } catch (e: any) {
      toast.error(e.message || '추가 실패')
    } finally {
      setAddingKeyword(false)
    }
  }

  // 키워드 삭제
  const handleDeleteKeyword = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/press/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success('키워드가 삭제되었습니다.')
      if (activeKeywordId === deleteTarget.id) setActiveKeywordId(null)
      fetchKeywords()
      fetchArticles()
    } catch (e: any) {
      toast.error(e.message || '삭제 실패')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // 수동 수집
  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/press/sync${qs}`, { method: 'POST' })
      const data = await res.json()
      const errors: string[] = data.errors || []
      if (errors.length > 0 && (data.inserted || 0) === 0) {
        setSyncMsg({ ok: false, text: `수집 실패: ${errors[0]}` })
      } else if (errors.length > 0) {
        setSyncMsg({ ok: true, text: `${data.inserted}건 수집 (일부 오류: ${errors.length}건)` })
      } else {
        setSyncMsg({ ok: true, text: `수집 완료 — ${data.inserted || 0}건 업데이트` })
      }
      await fetchArticles()
    } catch {
      setSyncMsg({ ok: false, text: '수집 실패' })
    } finally {
      setSyncing(false)
    }
  }

  // 클라이언트 사이드 필터링
  const filteredArticles = activeKeywordId
    ? articles.filter(a => a.keyword_id === activeKeywordId)
    : articles

  const grouped = groupByDate(filteredArticles)
  const dates = Object.keys(grouped)

  // 키워드별 기사 수 계산 (전체 기사 기준)
  const keywordArticleCounts = keywords.reduce<Record<number, number>>((acc, kw) => {
    acc[kw.id] = articles.filter(a => a.keyword_id === kw.id).length
    return acc
  }, {})

  return (
    <>
      <PageHeader
        title="언론보도"
        description="네이버 뉴스에서 키워드별 보도를 수집합니다. 매일 오전 9시 자동 갱신."
        actions={
          <>
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            <Button variant="glass" size="icon" onClick={fetchArticles} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="bg-brand-600 hover:bg-brand-700">
              <Play size={14} /> {syncing ? '수집 중...' : '지금 수집'}
            </Button>
          </>
        }
      />

      {syncMsg && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${syncMsg.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {syncMsg.text}
        </div>
      )}

      {/* 키워드 관리 영역 */}
      {selectedClinicId && (
        <Card variant="glass" className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-muted-foreground">검색 키워드</span>
            <span className="text-[10px] text-muted-foreground/60">최대 5개</span>
          </div>

          {/* 키워드 입력 */}
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !addingKeyword) handleAddKeyword() }}
              placeholder="키워드 입력 후 Enter"
              className="flex-1 h-8 text-sm"
              disabled={addingKeyword || keywords.length >= 5}
            />
            <Button
              size="sm"
              onClick={handleAddKeyword}
              disabled={addingKeyword || !newKeyword.trim() || keywords.length >= 5}
              className="h-8 bg-brand-600 hover:bg-brand-700"
            >
              <Plus size={14} /> 추가
            </Button>
          </div>

          {/* 키워드 칩 목록 */}
          {keywordsLoading ? (
            <div className="flex gap-2">
              {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
            </div>
          ) : keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <span
                  key={kw.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20"
                >
                  {kw.keyword}
                  <button
                    onClick={() => setDeleteTarget(kw)}
                    className="p-0.5 rounded-full hover:bg-brand-500/20 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60">
              키워드를 등록하면 해당 키워드로 뉴스를 검색합니다. 미등록 시 병원명으로 검색합니다.
            </p>
          )}
        </Card>
      )}

      {/* 키워드 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>키워드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.keyword}&rdquo; 키워드를 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteKeyword() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: '총 보도 수',  value: articles.length },
          { label: '언론사 수',   value: new Set(articles.map(a => a.source)).size },
          { label: '최근 7일',    value: articles.filter(a => {
            if (!a.published_at) return false
            return (Date.now() - toUtcDate(a.published_at).getTime()) < 7 * 24 * 3600 * 1000
          }).length },
          { label: '활성 키워드', value: `${keywords.length} / 5` },
        ].map(({ label, value }) => (
          <Card key={label} variant="glass" className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-foreground">{value}</p>}
          </Card>
        ))}
      </div>

      {/* 키워드 필터 탭 */}
      {keywords.length > 0 && !loading && (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveKeywordId(null)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeKeywordId === null
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            전체 ({articles.length})
          </button>
          {keywords.map(kw => (
            <button
              key={kw.id}
              onClick={() => setActiveKeywordId(activeKeywordId === kw.id ? null : kw.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeKeywordId === kw.id
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {kw.keyword} ({keywordArticleCounts[kw.id] || 0})
            </button>
          ))}
        </div>
      )}

      {/* 기사 목록 */}
      {loading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <Card key={i} variant="glass" className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array(3).fill(0).map((__, j) => <Skeleton key={j} className="h-10 rounded-xl" />)}
            </Card>
          ))}
        </div>
      ) : dates.length === 0 ? (
        <Card variant="glass" className="py-4">
          <EmptyState
            icon={Newspaper}
            title="수집된 언론보도가 없습니다."
            description={keywords.length > 0 ? "'지금 수집' 버튼을 눌러 키워드별 뉴스를 검색하세요." : "키워드를 등록하고 '지금 수집' 버튼을 눌러 뉴스를 검색하세요."}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {dates.map(date => (
            <Card key={date} variant="glass" className="p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-border dark:border-white/5 flex items-center gap-2">
                <Newspaper size={13} className="text-brand-400" />
                <span className="text-sm font-semibold text-foreground">{date}</span>
                <span className="text-xs text-muted-foreground ml-auto">{grouped[date].length}건</span>
              </div>
              <div className="divide-y divide-border dark:divide-white/5">
                {grouped[date].map(article => {
                  const matchedKeyword = keywords.find(k => k.id === article.keyword_id)
                  return (
                    <div key={article.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors group">
                      <div className="w-20 shrink-0">
                        <span className="text-xs font-medium text-muted-foreground truncate block">{article.source}</span>
                      </div>
                      <p className="flex-1 text-sm text-foreground/80 min-w-0 truncate">{article.title}</p>
                      {matchedKeyword && (
                        <span className="shrink-0 text-[10px] bg-muted/50 rounded-md px-1.5 py-0.5 text-muted-foreground">
                          {matchedKeyword.keyword}
                        </span>
                      )}
                      {article.url && (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-brand-400 shrink-0"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
