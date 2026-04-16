'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileEdit, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClient } from '@/components/ClientContext'
import { PageHeader } from '@/components/common'

const CATEGORY_LABELS: Record<string, string> = {
  place: '네이버 플레이스',
  website: '웹사이트',
  smartblock: '스마트블록',
  related: '함께많이찾는',
}

interface KeywordEntry {
  keyword_id: number
  keyword: string
  category: string
  rank_position: string
  url: string
  prev_rank: number | null // 전일 순위
}

export default function MonitoringInputPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user
  const { selectedClientId, setSelectedClientId, clients } = useClient()

  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }))
  const [entries, setEntries] = useState<KeywordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchKey, setFetchKey] = useState(0) // refetch 트리거용

  useEffect(() => {
    if (user && user.role !== 'superadmin' && user.role !== 'agency_staff') {
      router.replace('/monitoring')
    }
  }, [user, router])

  // 날짜 이동 (KST 타임존 명시)
  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00+09:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }))
  }

  // 키워드 + 기존 순위 로드
  useEffect(() => {
    if (!selectedClientId) {
      setEntries([])
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ client_id: String(selectedClientId), active_only: 'true' })
        const kwRes = await fetch(`/api/monitoring/keywords?${params}`)
        const kwData = await kwRes.json()
        const keywords = Array.isArray(kwData) ? kwData : []

        // 기존 순위 조회 (해당 월)
        const month = date.slice(0, 7)
        const rankParams = new URLSearchParams({ client_id: String(selectedClientId), month })
        const rankRes = await fetch(`/api/monitoring/rankings?${rankParams}`)
        const rankData = await rankRes.json()
        let existingRankings = rankData.rankings || []

        // 전일이 다른 월이면 전월 데이터도 조회
        const prevDate = new Date(date + 'T00:00:00')
        prevDate.setDate(prevDate.getDate() - 1)
        const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`
        const prevMonth = prevDateStr.slice(0, 7)

        if (prevMonth !== month) {
          const prevParams = new URLSearchParams({ client_id: String(selectedClientId), month: prevMonth })
          const prevRes = await fetch(`/api/monitoring/rankings?${prevParams}`)
          const prevData = await prevRes.json()
          existingRankings = [...existingRankings, ...(prevData.rankings || [])]
        }

        // 선택 날짜 및 전일 데이터 매핑
        const rankMap: Record<number, { rank: number | null; url?: string }> = {}
        const prevRankMap: Record<number, number | null> = {}
        for (const r of existingRankings) {
          if (r.rank_date === date) {
            rankMap[r.keyword_id] = { rank: r.rank_position, url: r.url }
          }
          if (r.rank_date === prevDateStr) {
            prevRankMap[r.keyword_id] = r.rank_position
          }
        }

        const newEntries: KeywordEntry[] = keywords.map((kw: any) => ({
          keyword_id: kw.id,
          keyword: kw.keyword,
          category: kw.category,
          rank_position: rankMap[kw.id]?.rank?.toString() || '',
          url: rankMap[kw.id]?.url || '',
          prev_rank: prevRankMap[kw.id] ?? null,
        }))

        setEntries(newEntries)
      } catch {
        toast.error('키워드 로드 실패')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedClientId, date, fetchKey])

  const updateEntry = (idx: number, field: 'rank_position' | 'url', value: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const handleSave = async () => {
    const rankings = entries
      .filter(e => e.rank_position !== '')
      .map(e => ({
        keyword_id: e.keyword_id,
        rank_date: date,
        rank_position: parseInt(e.rank_position, 10) || null,
        url: e.url || null,
      }))

    if (rankings.length === 0) {
      toast.error('순위를 최소 1개 이상 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/monitoring/rankings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankings }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '저장 실패')
      }
      toast.success(`${data.count}개 순위가 저장되었습니다.`)
      // fetchKey 변경으로 useEffect 재실행 → 전체 데이터 refetch
      setFetchKey(k => k + 1)
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // 카테고리별 그룹핑
  const groupedEntries = entries.reduce((acc, entry, idx) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push({ ...entry, _idx: idx })
    return acc
  }, {} as Record<string, (KeywordEntry & { _idx: number })[]>)

  // 날짜 포맷
  const dateObj = new Date(date + 'T00:00:00')
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()]

  if (user && user.role !== 'superadmin' && user.role !== 'agency_staff') return null

  return (
    <>
      <PageHeader icon={FileEdit} title="순위 입력" description="일별 순위를 입력하세요" />

      {/* 클라이언트 + 날짜 선택 */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">클라이언트</Label>
          <Select
            value={selectedClientId ? String(selectedClientId) : '_none'}
            onValueChange={v => setSelectedClientId(v === '_none' ? null : Number(v))}
          >
            <SelectTrigger className="w-[200px] bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none" disabled className="text-muted-foreground">클라이언트 선택</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">날짜</Label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-10 w-8">
              <ChevronLeft size={16} />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-[160px] bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground text-center"
            />
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-10 w-8">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <div className="mt-5">
          <span className={`text-sm ${dateObj.getDay() === 0 ? 'text-red-500' : dateObj.getDay() === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}>({dayOfWeek})</span>
        </div>
      </div>

      {loading ? (
        <Card variant="glass" className="p-6">
          <Skeleton className="h-[200px] w-full" />
        </Card>
      ) : entries.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <p className="text-muted-foreground">{selectedClientId ? '등록된 키워드가 없습니다.' : '클라이언트을 선택해주세요.'}</p>
        </Card>
      ) : (
        <>
          {Object.entries(groupedEntries).map(([cat, items]) => (
            <Card key={cat} variant="glass" className="p-5 mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border dark:border-white/10">{CATEGORY_LABELS[cat] || cat}</h3>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <th className="text-left pb-2 w-[180px]">키워드</th>
                    <th className="text-center pb-2 w-[60px]">전일</th>
                    <th className="text-center pb-2 w-[90px]">순위</th>
                    {cat === 'smartblock' && <th className="text-left pb-2">URL</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => (
                    <tr key={entry.keyword_id} className="border-t border-border dark:border-white/5">
                      <td className="text-sm text-foreground/80 py-2 pr-2">{entry.keyword}</td>
                      <td className="py-2">
                        <span className={`block text-center text-xs font-medium ${
                          entry.prev_rank == null ? 'text-muted-foreground/60' :
                          entry.prev_rank <= 3 ? 'text-emerald-400' :
                          entry.prev_rank <= 10 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {entry.prev_rank ?? '-'}
                        </span>
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          min="1"
                          value={entry.rank_position}
                          onChange={e => updateEntry(entry._idx, 'rank_position', e.target.value)}
                          placeholder="순위"
                          className="w-[90px] bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground text-center"
                        />
                      </td>
                      {cat === 'smartblock' && (
                        <td className="py-2 pl-1">
                          <Input
                            type="text"
                            value={entry.url}
                            onChange={e => updateEntry(entry._idx, 'url', e.target.value)}
                            placeholder="URL"
                            className="w-full bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}

          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700"
            >
              <Save size={16} />
              {saving ? '저장 중...' : '전체 저장'}
            </Button>
          </div>
        </>
      )}
    </>
  )
}
