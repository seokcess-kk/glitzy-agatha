'use client'

import { useState } from 'react'
import { subDays, startOfDay } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { getKstDateString } from '@/lib/date'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: number
  clientName?: string
  onComplete?: () => void
}

interface BackfillResult {
  date: string
  platform: string
  count: number
  error: string | null
}

interface BackfillResponse {
  syncedDays?: number
  totalCount?: number
  errorCount?: number
  results?: BackfillResult[]
  error?: string
}

export default function BackfillDialog({ open, onOpenChange, clientId, clientName, onComplete }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const yesterday = startOfDay(subDays(new Date(), 1))
    return { from: subDays(yesterday, 6), to: yesterday }
  })
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState<BackfillResponse | null>(null)
  // 기본 true (캠페인 레벨만 — 빠른 처리). 광고 소재 분석이 필요하면 OFF
  const [skipAdLevel, setSkipAdLevel] = useState(true)

  const startDateStr = dateRange.from ? getKstDateString(dateRange.from) : ''
  const endDateStr = dateRange.to ? getKstDateString(dateRange.to) : ''

  const dayCount =
    dateRange.from && dateRange.to
      ? Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1)
      : 0

  const handleRun = async () => {
    if (!startDateStr || !endDateStr) {
      toast.error('시작일과 종료일을 선택해주세요.')
      return
    }
    if (dayCount > 90) {
      toast.error('최대 90일까지 가능합니다.')
      return
    }

    setRunning(true)
    setResponse(null)
    try {
      const res = await fetch('/api/admin/backfill-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          startDate: startDateStr,
          endDate: endDateStr,
          skipAdLevel,
        }),
      })

      // 응답이 JSON 이 아닐 수 있음 (Vercel timeout HTML 등)
      const text = await res.text()
      let data: BackfillResponse | null = null
      try {
        data = JSON.parse(text) as BackfillResponse
      } catch {
        // Vercel 504 / function timeout 등 HTML 응답 케이스
        if (res.status === 504 || res.status === 408 || /timeout|gateway/i.test(text)) {
          toast.error(
            '백필 시간 초과 — 더 짧은 기간(예: 7~10일)으로 나눠서 진행해주세요. 광고 수가 많을수록 한 번에 처리 가능한 일수가 줄어듭니다.',
            { duration: 10000 },
          )
        } else {
          toast.error(`백필 실패 — HTTP ${res.status} (응답 형식 비정상)`, { duration: 8000 })
        }
        // 일부 일자는 이미 DB 에 들어갔을 수 있음 → 차트 갱신은 시도
        onComplete?.()
        return
      }

      if (!res.ok) {
        toast.error(`백필 실패 — ${data?.error || `HTTP ${res.status}`}`)
        return
      }

      setResponse(data)
      const errs = data?.errorCount ?? 0
      if (errs === 0) {
        toast.success(
          `백필 완료 (${data?.syncedDays}일, 총 ${data?.totalCount ?? 0}건)`,
        )
      } else {
        toast.error(
          `백필 부분 성공 — 성공 ${(data?.totalCount ?? 0)}건 / 실패 ${errs}건`,
          { duration: 8000 },
        )
      }
      onComplete?.()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      toast.error(`백필 호출 실패 — ${message}`)
    } finally {
      setRunning(false)
    }
  }

  // 결과를 매체별로 집계 (카드용)
  const platformSummary = response?.results
    ? Array.from(
        response.results.reduce((map, r) => {
          const cur = map.get(r.platform) || { count: 0, errors: 0 }
          cur.count += r.count
          if (r.error) cur.errors += 1
          map.set(r.platform, cur)
          return map
        }, new Map<string, { count: number; errors: number }>()),
      )
    : []

  return (
    <Dialog open={open} onOpenChange={val => !running && onOpenChange(val)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            과거 광고 데이터 백필{clientName ? ` — ${clientName}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs">
            기간을 선택하면 해당 일자의 광고 통계를 일별로 다시 수집합니다. Vercel function timeout(5분) 때문에 광고 수가 많은 클라이언트는 7~10일씩 나눠서 진행하는 것을 권장합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">기간 (최대 90일)</Label>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              numberOfMonths={1}
            />
            <p className="text-xs text-muted-foreground">
              {startDateStr} ~ {endDateStr} ({dayCount}일)
            </p>
            {dayCount > 14 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                ⚠ 14일 이상은 timeout 가능성이 있습니다. 7~10일 단위로 나눠서 진행을 권장합니다.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">캠페인 레벨만 수집 (빠름)</Label>
              <p className="text-xs text-muted-foreground">
                광고 소재(ad) 레벨 통계는 건너뛰어 처리 시간을 대폭 단축합니다. 광고 소재별 분석이 필요하면 OFF.
              </p>
            </div>
            <Switch checked={skipAdLevel} onCheckedChange={setSkipAdLevel} disabled={running} />
          </div>

          {response && (
            <div className="rounded-md border border-border p-3 space-y-2 text-sm">
              <p className="font-medium">
                {response.syncedDays}일 처리 완료 — 총 {response.totalCount ?? 0}건 수집
                {(response.errorCount ?? 0) > 0 && (
                  <span className="ml-2 text-red-500">실패 {response.errorCount}건</span>
                )}
              </p>
              {platformSummary.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {platformSummary.map(([platform, stats]) => (
                    <li key={platform}>
                      <span className="font-medium text-foreground">{platform}</span>
                      <span> — {stats.count}건</span>
                      {stats.errors > 0 && (
                        <span className="ml-1 text-red-500">({stats.errors}일 실패)</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
              {response ? '닫기' : '취소'}
            </Button>
            <Button
              onClick={handleRun}
              disabled={running || dayCount === 0 || dayCount > 90}
              className="bg-brand-600 hover:bg-brand-700"
            >
              {running ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 실행 중 ({dayCount}일)
                </>
              ) : (
                '백필 시작'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
