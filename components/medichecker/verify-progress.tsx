'use client'
import { useState } from 'react'
import { Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { VerifyStage, VerifyProgress as VerifyProgressType } from '@/lib/medichecker/types'
import { STAGE_LABELS } from '@/lib/medichecker/types'

const STAGES_ORDER: VerifyStage[] = [
  'keyword_scan', 'classification', 'query_rewrite',
  'search', 'relation_enrichment', 'judgment', 'verification',
]

interface VerifyProgressProps {
  progress: Map<VerifyStage, VerifyProgressType>
  currentStage: VerifyStage | null
  isComplete: boolean
}

export function VerifyProgress({ progress, currentStage, isComplete }: VerifyProgressProps) {
  const [expanded, setExpanded] = useState(true)

  const completedCount = STAGES_ORDER.filter(s => progress.get(s)?.status === 'done').length
  const totalStages = STAGES_ORDER.length
  const progressPct = Math.round((completedCount / totalStages) * 100)

  return (
    <Card variant="glass" className="p-4 md:p-5 animate-fade-in-up">
      {/* 헤더 */}
      <button
        type="button"
        className="w-full flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {isComplete ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center animate-pulse">
              <Loader2 size={14} className="text-white animate-spin" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {isComplete ? '검증 완료' : currentStage ? STAGE_LABELS[currentStage] || currentStage : '검증 준비 중...'}
            </p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{totalStages} 단계 완료
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">{progressPct}%</span>
          {expanded ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {/* 프로그레스 바 */}
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isComplete ? 'bg-emerald-500' : 'bg-brand-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 단계 상세 */}
      {expanded && (
        <div className="mt-4 space-y-2">
          {STAGES_ORDER.map((stage) => {
            const p = progress.get(stage)
            const isDone = p?.status === 'done'
            const isRunning = p?.status === 'running'

            return (
              <div key={stage} className="flex items-center gap-3">
                {/* 상태 원 */}
                {isDone ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                ) : isRunning ? (
                  <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shrink-0 animate-pulse">
                    <Loader2 size={12} className="text-white animate-spin" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {STAGES_ORDER.indexOf(stage) + 1}
                    </span>
                  </div>
                )}

                {/* 라벨 */}
                <span
                  className={`text-sm ${
                    isDone
                      ? 'text-foreground'
                      : isRunning
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                  }`}
                >
                  {STAGE_LABELS[stage] || stage}
                </span>

                {/* 완료 상태 표시 */}
                {isDone && (
                  <span className="text-xs text-emerald-500 ml-auto">완료</span>
                )}
                {isRunning && (
                  <span className="text-xs text-brand-400 ml-auto">진행 중...</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 완료 메시지 */}
      {isComplete && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-xs text-emerald-400">모든 검증 단계가 완료되었습니다.</p>
        </div>
      )}
    </Card>
  )
}
