'use client'

/**
 * 수동 인입 보정 다이얼로그 (월 단위 캘린더 그리드)
 *
 * - 사용처: 광고 성과 페이지의 ADN 탭 등 매체 전환 누락이 잦은 매체.
 * - UX: 월 캘린더 그리드에서 일자 클릭 → 하단 편집 폼에서 보정 수치/사유 입력.
 *       빈 셀과 보정된 셀을 시각적으로 구분.
 * - 권한: client_admin 이상만 (API 가 401/403 반환).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getKstDateString } from '@/lib/date'
import type { ApiPlatform } from '@/lib/platform'
import { API_PLATFORM_LABELS } from '@/lib/platform'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: number
  clientName?: string
  platform: ApiPlatform
  onSaved?: () => void
}

interface ManualInflowRow {
  id: number
  stat_date: string
  count: number
  reason: string | null
  updated_at: string | null
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function getMonthRange(year: number, month0: number): { start: string; end: string } {
  const start = new Date(year, month0, 1)
  const end = new Date(year, month0 + 1, 0)
  return { start: getKstDateString(start), end: getKstDateString(end) }
}

function buildCalendarCells(year: number, month0: number): Array<{ date: string; inMonth: boolean; day: number }> {
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  const leading = first.getDay()  // 0=일
  const cells: Array<{ date: string; inMonth: boolean; day: number }> = []

  // 이전 달 회색 칸
  for (let i = leading - 1; i >= 0; i--) {
    const d = new Date(year, month0, -i)
    cells.push({ date: getKstDateString(d), inMonth: false, day: d.getDate() })
  }
  // 이번 달
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, month0, day)
    cells.push({ date: getKstDateString(d), inMonth: true, day })
  }
  // 다음 달 (총 42칸 = 6주)
  while (cells.length < 42) {
    const idx = cells.length - leading - last.getDate() + 1
    const d = new Date(year, month0 + 1, idx)
    cells.push({ date: getKstDateString(d), inMonth: false, day: d.getDate() })
  }
  return cells
}

export default function ManualInflowDialog({ open, onOpenChange, clientId, clientName, platform, onSaved }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month0, setMonth0] = useState(today.getMonth())  // 0-based
  const [rows, setRows] = useState<ManualInflowRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [countInput, setCountInput] = useState<string>('')
  const [reasonInput, setReasonInput] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const platformLabel = API_PLATFORM_LABELS[platform]

  const rowsByDate = useMemo(() => {
    const map = new Map<string, ManualInflowRow>()
    for (const r of rows) map.set(r.stat_date, r)
    return map
  }, [rows])

  const monthLabel = `${year}년 ${month0 + 1}월`

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getMonthRange(year, month0)
      const params = new URLSearchParams({ platform, start, end })
      const res = await fetch(`/api/manual-inflows?${params.toString()}`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json()
      const list: ManualInflowRow[] = Array.isArray(data) ? data : (data.data || [])
      setRows(list)
    } catch {
      toast.error('수동 인입 조회에 실패했습니다.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [year, month0, platform])

  useEffect(() => {
    if (open) {
      fetchRows()
      setSelectedDate(null)
      setCountInput('')
      setReasonInput('')
    }
  }, [open, fetchRows])

  // 선택된 일자가 바뀌면 폼을 기존 값으로 채움
  useEffect(() => {
    if (!selectedDate) {
      setCountInput('')
      setReasonInput('')
      return
    }
    const existing = rowsByDate.get(selectedDate)
    setCountInput(existing ? String(existing.count) : '')
    setReasonInput(existing?.reason || '')
  }, [selectedDate, rowsByDate])

  const goPrevMonth = () => {
    if (month0 === 0) { setMonth0(11); setYear(year - 1) }
    else setMonth0(month0 - 1)
    setSelectedDate(null)
  }
  const goNextMonth = () => {
    if (month0 === 11) { setMonth0(0); setYear(year + 1) }
    else setMonth0(month0 + 1)
    setSelectedDate(null)
  }

  const handleSave = async () => {
    if (!selectedDate) return
    const count = Number(countInput)
    if (!Number.isFinite(count) || count < 0) {
      toast.error('보정값은 0 이상의 정수여야 합니다.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/manual-inflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          stat_date: selectedDate,
          count: Math.floor(count),
          reason: reasonInput.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err?.error === 'string' ? err.error : '저장 실패')
      }
      toast.success(`${selectedDate} 보정값이 저장되었습니다.`)
      await fetchRows()
      onSaved?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedDate) return
    const existing = rowsByDate.get(selectedDate)
    if (!existing) {
      setSelectedDate(null)
      return
    }
    if (!confirm(`${selectedDate} 보정값을 삭제하시겠습니까?`)) return

    setDeleting(true)
    try {
      const res = await fetch('/api/manual-inflows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, stat_date: selectedDate }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err?.error === 'string' ? err.error : '삭제 실패')
      }
      toast.success(`${selectedDate} 보정값이 삭제되었습니다.`)
      setSelectedDate(null)
      await fetchRows()
      onSaved?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const cells = useMemo(() => buildCalendarCells(year, month0), [year, month0])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>수동 인입 보정 — {clientName ? `${clientName} (${platformLabel})` : platformLabel}</DialogTitle>
          <DialogDescription className="text-xs">
            매체 전환이 누락된 일자에 실제 인입 수를 직접 보정합니다. 입력값은 인입 KPI/추세에 자동으로 합산됩니다.
          </DialogDescription>
        </DialogHeader>

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={goPrevMonth} disabled={loading} aria-label="이전 달">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium tabular-nums">{monthLabel}</span>
          <Button variant="ghost" size="sm" onClick={goNextMonth} disabled={loading} aria-label="다음 달">
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground pt-2">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`text-center py-1 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : ''}`}>{w}</div>
          ))}
        </div>

        {/* 캘린더 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const row = rowsByDate.get(cell.date)
              const isSelected = selectedDate === cell.date
              const hasValue = !!row && row.count > 0
              return (
                <button
                  type="button"
                  key={cell.date}
                  onClick={() => cell.inMonth && setSelectedDate(cell.date)}
                  disabled={!cell.inMonth}
                  className={[
                    'aspect-square rounded-md border text-xs flex flex-col items-center justify-center gap-0.5 transition-colors',
                    cell.inMonth ? 'cursor-pointer' : 'opacity-30 cursor-default',
                    isSelected
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-950'
                      : hasValue
                        ? 'border-brand-400/50 bg-brand-50/50 hover:bg-brand-50 dark:bg-brand-950/40'
                        : 'border-border hover:bg-muted',
                  ].join(' ')}
                >
                  <span className="text-foreground">{cell.day}</span>
                  {hasValue && (
                    <span className="font-medium text-brand-700 dark:text-brand-300 tabular-nums">
                      +{row.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* 편집 영역 */}
        {selectedDate && (
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">선택된 일자</Label>
              <span className="text-sm font-medium tabular-nums">{selectedDate}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-inflow-count" className="text-xs text-muted-foreground">보정 인입 수</Label>
              <Input
                id="manual-inflow-count"
                type="number"
                min={0}
                step={1}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                placeholder="0"
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-inflow-reason" className="text-xs text-muted-foreground">사유 (선택)</Label>
              <Textarea
                id="manual-inflow-reason"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="예: 매체 트래킹 누락, 실제 전화 문의 N건 확인"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-brand-600 hover:bg-brand-700"
                disabled={saving || deleting}
              >
                {saving ? '저장 중...' : '저장'}
              </Button>
              {rowsByDate.has(selectedDate) && (
                <Button
                  onClick={handleDelete}
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10 ml-auto"
                  disabled={saving || deleting}
                >
                  <Trash2 size={14} className="mr-1" />
                  삭제
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
