'use client'

import { useState } from 'react'
import { format, subDays, startOfDay, startOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePickerProps {
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  allowFuture?: boolean
  bookedDates?: Date[]
}

const PRESETS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '14일', days: 14 },
  { label: '이번 달', days: -1 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
]

export function DateRangePicker({ dateRange, onDateRangeChange, allowFuture = false, bookedDates }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const handlePreset = (days: number) => {
    const to = startOfDay(new Date())
    const from = days === -1 ? startOfMonth(to) : days === 0 ? to : subDays(to, days)
    onDateRangeChange({ from, to })
    setOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onDateRangeChange({ from: range.from, to: range.to || range.from })
    }
  }

  const formatDateLabel = (date: Date) => format(date, 'yyyy.MM.dd', { locale: ko })

  const from = dateRange.from
  const to = dateRange.to

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 px-3 bg-muted/50 border border-border text-foreground text-sm hover:bg-muted gap-2 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          <CalendarIcon size={14} className="text-muted-foreground" />
          {from ? (
            <span className="tabular-nums flex items-center gap-1.5">
              <span>{formatDateLabel(from)}</span>
              <span className="text-muted-foreground">~</span>
              <span>{to ? formatDateLabel(to) : '종료일'}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">기간 선택</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {/* 선택된 기간 표시 */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">시작일</p>
            <p className={`text-sm font-medium tabular-nums ${from ? 'text-foreground' : 'text-muted-foreground'}`}>
              {from ? format(from, 'yyyy.MM.dd (eee)', { locale: ko }) : '선택'}
            </p>
          </div>
          <span className="text-muted-foreground text-xs mt-3">~</span>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">종료일</p>
            <p className={`text-sm font-medium tabular-nums ${to ? 'text-foreground' : 'text-muted-foreground'}`}>
              {to ? format(to, 'yyyy.MM.dd (eee)', { locale: ko }) : '선택'}
            </p>
          </div>
        </div>
        {/* 프리셋 버튼 */}
        <div className="flex gap-1 px-3 pb-0">
          {PRESETS.map(p => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10"
              onClick={() => handlePreset(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleCalendarSelect}
          numberOfMonths={2}
          disabled={allowFuture ? undefined : { after: new Date() }}
          {...(bookedDates?.length ? {
            modifiers: { booked: bookedDates },
            modifiersClassNames: { booked: 'rdp-booked-day' },
          } : {})}
        />
      </PopoverContent>
    </Popover>
  )
}
