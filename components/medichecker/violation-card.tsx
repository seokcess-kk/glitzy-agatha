'use client'
import { useState, useCallback } from 'react'
import { Copy, Check, ChevronDown, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Violation } from '@/lib/medichecker/types'

interface ViolationCardProps {
  violation: Violation
  index: number
  isSelected?: boolean
  onSelect?: (index: number) => void
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 90) {
    return {
      label: '높음',
      className: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
      borderColor: 'border-l-rose-500',
    }
  }
  if (confidence >= 60) {
    return {
      label: '중간',
      className: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      borderColor: 'border-l-amber-500',
    }
  }
  return {
    label: '낮음',
    className: 'bg-muted text-muted-foreground border border-border',
    borderColor: 'border-l-border',
  }
}

// ============================================================
// ExampleFix (확장 시에만 표시)
// ============================================================

function ExampleFix({ violation }: { violation: Violation }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!violation.exampleFix) return
    try {
      await navigator.clipboard.writeText(violation.exampleFix)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }, [violation.exampleFix])

  if (!violation.exampleFix && !violation.originalText) return null

  return (
    <div className="mt-3 rounded-lg bg-brand-500/5 border border-brand-500/20 p-3">
      <p className="text-xs font-medium text-foreground mb-2">수정 예시</p>

      {violation.originalText && (
        <div className="mb-2">
          <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2">
            <p className="text-sm text-rose-400 line-through">{violation.originalText}</p>
          </div>
        </div>
      )}

      {violation.exampleFix && (
        <div>
          {violation.originalText && (
            <div className="flex justify-center my-1.5">
              <ArrowDown size={14} className="text-muted-foreground" />
            </div>
          )}
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 flex items-start justify-between gap-2">
            <p className="text-sm text-emerald-400 flex-1">
              {violation.type === 'omission' ? highlightOmission(violation.exampleFix) : violation.exampleFix}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleCopy() }}
              className="h-7 px-2 bg-card hover:bg-muted border border-border text-foreground shrink-0"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span className="text-xs">{copied ? '복사됨' : '복사'}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function highlightOmission(text: string): React.ReactNode {
  if (!text.includes('※')) return text
  const parts = text.split('※')
  return (
    <>
      {parts[0]}
      <span className="bg-emerald-500/20 text-emerald-300 rounded-sm px-0.5">
        ※{parts.slice(1).join('※')}
      </span>
    </>
  )
}

// ============================================================
// ViolationCard — 컴팩트 기본 + 확장 상세
// ============================================================

export function ViolationCard({ violation, index, isSelected, onSelect }: ViolationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const badge = getConfidenceBadge(violation.confidence)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div
      className={`rounded-lg border-l-4 border bg-card transition-all duration-200 ${
        badge.borderColor
      } ${
        isSelected
          ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20'
          : 'border-border hover:border-border/80'
      }`}
    >
      {/* === 컴팩트 헤더 (항상 표시) === */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => onSelect?.(index)}
      >
        {/* 1행: 메타 정보 */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">#{index + 1}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              {violation.type === 'expression' ? '표현' : '누락'}
            </span>
            <span className="text-xs text-muted-foreground truncate">{violation.article}</span>
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${badge.className}`}>
            {violation.confidence}%
          </span>
        </div>

        {/* 2행: 위반 텍스트 (최대 2줄) */}
        <p className="text-sm text-foreground font-medium line-clamp-2">&ldquo;{violation.text}&rdquo;</p>

        {/* 3행: 수정 제안 한줄 요약 */}
        {violation.suggestion && (
          <p className="text-xs text-emerald-400 mt-1.5 line-clamp-1">
            → {violation.suggestion}
          </p>
        )}
      </div>

      {/* === 확장 토글 === */}
      <div className="px-3 pb-2">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
          onClick={handleToggle}
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
          {expanded ? '접기' : '상세 보기'}
        </button>
      </div>

      {/* === 확장 영역 (상세) === */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-3 animate-fade-in-up">
          {/* 설명 */}
          <p className="text-xs text-muted-foreground leading-relaxed">{violation.description}</p>

          {/* 수정 제안 (전체) */}
          {violation.suggestion && (
            <div className="pl-3 border-l-2 border-l-emerald-500 bg-emerald-500/10 rounded-r-md py-2 pr-3">
              <p className="text-[10px] font-medium text-emerald-500 mb-0.5 uppercase tracking-wider">제안</p>
              <p className="text-xs text-emerald-400">{violation.suggestion}</p>
            </div>
          )}

          {/* 수정 예시 */}
          <ExampleFix violation={violation} />

          {/* 법령 근거 */}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">관련 법령</p>
            <p className="text-sm text-foreground">{violation.article}</p>
          </div>

          {/* 근거 */}
          {violation.evidence && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">근거</p>
              <p className="text-xs text-foreground leading-relaxed">{violation.evidence}</p>
            </div>
          )}

          {/* 리뷰 참고사항 */}
          {violation.reviewNote && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">리뷰 참고</p>
              <p className="text-xs text-amber-400">{violation.reviewNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
