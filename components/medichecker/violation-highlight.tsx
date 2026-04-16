'use client'
import { useMemo } from 'react'
import type { Violation } from '@/lib/medichecker/types'

interface ViolationHighlightProps {
  text: string
  violations: Violation[]
  selectedIndex?: number | null
  onSelectViolation?: (index: number) => void
}

interface HighlightRange {
  start: number
  end: number
  confidence: number
  violationIndex: number
}

function getHighlightClass(confidence: number): string {
  if (confidence >= 90) {
    return 'bg-rose-500/20 text-rose-300 border-b-2 border-rose-500 cursor-pointer'
  }
  if (confidence >= 60) {
    return 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-500 cursor-pointer'
  }
  return 'bg-muted text-muted-foreground border-b-2 border-border cursor-pointer'
}

function getSelectedClass(confidence: number): string {
  if (confidence >= 90) {
    return 'bg-rose-500/30 text-rose-200 border-b-2 border-rose-400 ring-2 ring-rose-500/30 cursor-pointer'
  }
  if (confidence >= 60) {
    return 'bg-amber-500/30 text-amber-200 border-b-2 border-amber-400 ring-2 ring-amber-500/30 cursor-pointer'
  }
  return 'bg-muted/80 text-foreground border-b-2 border-border ring-2 ring-border cursor-pointer'
}

export function ViolationHighlight({ text, violations, selectedIndex, onSelectViolation }: ViolationHighlightProps) {
  const ranges = useMemo(() => {
    const result: HighlightRange[] = []

    violations.forEach((violation, vIdx) => {
      if (violation.highlightRanges && violation.highlightRanges.length > 0) {
        for (const [start, end] of violation.highlightRanges) {
          result.push({ start, end, confidence: violation.confidence, violationIndex: vIdx })
        }
      } else if (violation.originalText || violation.text) {
        const searchText = violation.originalText || violation.text
        const idx = text.indexOf(searchText)
        if (idx !== -1) {
          result.push({
            start: idx,
            end: idx + searchText.length,
            confidence: violation.confidence,
            violationIndex: vIdx,
          })
        }
      }
    })

    // 정렬: 시작 위치 기준
    result.sort((a, b) => a.start - b.start)

    // 겹침 제거: 앞 범위 우선
    const merged: HighlightRange[] = []
    for (const r of result) {
      if (merged.length === 0 || r.start >= merged[merged.length - 1].end) {
        merged.push(r)
      }
    }

    return merged
  }, [text, violations])

  if (ranges.length === 0) {
    return (
      <div className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
        {text}
      </div>
    )
  }

  const segments: React.ReactNode[] = []
  let lastEnd = 0

  ranges.forEach((range, i) => {
    // 하이라이트 전 일반 텍스트
    if (range.start > lastEnd) {
      segments.push(
        <span key={`text-${i}`}>{text.slice(lastEnd, range.start)}</span>
      )
    }

    const isSelected = selectedIndex === range.violationIndex
    const className = isSelected
      ? getSelectedClass(range.confidence)
      : getHighlightClass(range.confidence)

    segments.push(
      <span
        key={`hl-${i}`}
        className={`rounded-sm px-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        onClick={() => onSelectViolation?.(range.violationIndex)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectViolation?.(range.violationIndex)
          }
        }}
        aria-label={`위반 항목 ${range.violationIndex + 1}`}
      >
        {text.slice(range.start, range.end)}
      </span>
    )
    lastEnd = range.end
  })

  // 마지막 텍스트
  if (lastEnd < text.length) {
    segments.push(
      <span key="text-end">{text.slice(lastEnd)}</span>
    )
  }

  return (
    <div className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
      {segments}
    </div>
  )
}
