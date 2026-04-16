'use client'
import { useState, useCallback } from 'react'
import { AlertTriangle, Pencil, ClipboardPaste } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ViolationHighlight } from './violation-highlight'
import type { Violation } from '@/lib/medichecker/types'

const MAX_CHARS = 5000
const WARN_CHARS = 4500

interface TextInputCardProps {
  text: string
  onTextChange: (text: string) => void
  violations?: Violation[]
  highlightMode?: boolean
  onToggleHighlight?: () => void
  selectedViolationIndex?: number | null
  onSelectViolation?: (index: number) => void
  disabled?: boolean
}

export function TextInputCard({
  text,
  onTextChange,
  violations = [],
  highlightMode = false,
  onToggleHighlight,
  selectedViolationIndex,
  onSelectViolation,
  disabled,
}: TextInputCardProps) {
  const [isFocused, setIsFocused] = useState(false)

  const charCount = text.length
  const isOverLimit = charCount > MAX_CHARS
  const isNearLimit = charCount > WARN_CHARS

  const handlePaste = useCallback(async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      if (clipText) {
        onTextChange(clipText)
      }
    } catch {
      // 클립보드 접근 실패 시 무시
    }
  }, [onTextChange])

  const hasOmissionViolations = violations.some(v => v.type === 'omission')

  return (
    <Card variant="glass" className="p-4 md:p-5 animate-fade-in-up">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label htmlFor="mc-ad-text" className="text-sm font-medium text-foreground">광고 문구 입력</label>
          {violations.length > 0 && onToggleHighlight && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleHighlight}
              className="text-xs h-7"
            >
              <Pencil size={12} />
              {highlightMode ? '편집 모드' : '하이라이트'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePaste}
            disabled={disabled || highlightMode}
            className="text-xs h-7"
          >
            <ClipboardPaste size={12} />
            붙여넣기
          </Button>
        </div>
      </div>

      {/* 텍스트 입력 또는 하이라이트 뷰 */}
      {highlightMode && violations.length > 0 ? (
        <div className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card p-3">
          <ViolationHighlight
            text={text}
            violations={violations}
            selectedIndex={selectedViolationIndex}
            onSelectViolation={onSelectViolation}
          />
        </div>
      ) : (
        <textarea
          id="mc-ad-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="검수할 광고 문구를 입력하세요..."
          disabled={disabled}
          className={`w-full min-h-[200px] max-h-[400px] resize-y rounded-lg border bg-card text-foreground text-sm leading-relaxed p-3 placeholder:text-muted-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 ${
            isFocused ? 'border-brand-500' : 'border-border'
          }`}
          maxLength={MAX_CHARS + 100}
        />
      )}

      {/* 하단 정보 영역 */}
      <div className="flex items-center justify-between mt-2">
        {/* 범례 (하이라이트 모드 시) */}
        {highlightMode && violations.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/50" />
              <span className="text-muted-foreground">높음 (90%+)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/50" />
              <span className="text-muted-foreground">중간 (60-89%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" />
              <span className="text-muted-foreground">낮음</span>
            </span>
          </div>
        )}

        {/* 글자 수 */}
        {!highlightMode && (
          <div className="ml-auto">
            <span className={`text-xs tabular-nums ${
              isOverLimit ? 'text-rose-400' : isNearLimit ? 'text-amber-400' : 'text-muted-foreground'
            }`}>
              {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 누락 경고 */}
      {hasOmissionViolations && highlightMode && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-400">필수 고지사항 누락 의심</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              아래 위반 항목에서 누락된 고지사항을 확인하세요. 원문에는 표시되지 않지만 반드시 추가해야 할 내용입니다.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
