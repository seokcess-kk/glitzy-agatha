'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common'
import { Users, Filter } from 'lucide-react'
import { FUNNEL_COLORS } from '@/lib/chart-colors'
import { useState, useRef } from 'react'

interface FunnelStage {
  stage: string
  label: string
  count: number
  rate: number
  dropoff: number
}

interface FunnelData {
  funnel?: {
    stages: FunnelStage[]
    totalConversionRate: number
    holdCount?: number
    holdRate?: number
    lostCount?: number
    lostRate?: number
  }
}

interface FunnelSectionProps {
  data: FunnelData | null
  loading?: boolean
}

/** Agatha 3단계 퍼널 필터 */
function filterThreeStages(stages: FunnelStage[]): FunnelStage[] {
  const KEEP = ['New', 'InProgress', 'Converted']
  const filtered = stages.filter(s => KEEP.includes(s.stage))
  if (filtered.length === 0) return []

  // dropoff 재계산
  return filtered.map((stage, i) => {
    if (i === 0) return { ...stage, dropoff: 0 }
    const prev = filtered[i - 1]
    const dropoff = prev.count > 0 ? Number((((prev.count - stage.count) / prev.count) * 100).toFixed(1)) : 0
    return { ...stage, dropoff }
  })
}

/** 가장 큰 이탈 구간 감지 */
function getMaxDropoffInsight(stages: FunnelStage[]): string | null {
  if (stages.length < 2) return null
  let maxIdx = 1
  let maxDrop = 0
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].dropoff > maxDrop) {
      maxDrop = stages[i].dropoff
      maxIdx = i
    }
  }
  if (maxDrop === 0) return null
  return `${stages[maxIdx - 1].label} → ${stages[maxIdx].label} 구간에서 ${maxDrop}% 이탈이 가장 큽니다`
}

/** 단계별 링크 매핑 */
const STAGE_LINKS: Record<string, string> = {
  New: '/customers',
  InProgress: '/customers',
  Converted: '/customers',
}

const NODE_SIZE = 40

/** 직전 단계 대비 전환율 기준 커넥터 색상 */
function getSegmentColor(prevCount: number, currentCount: number): string {
  if (prevCount === 0) return FUNNEL_COLORS.brand
  const rate = (currentCount / prevCount) * 100
  if (rate >= 70) return FUNNEL_COLORS.positive
  if (rate >= 50) return FUNNEL_COLORS.warning
  return FUNNEL_COLORS.negative
}

/** 노드 배경 opacity — 0명이면 연하게 */
function getNodeOpacity(count: number): number {
  return count === 0 ? 0.4 : 1
}

export function FunnelSection({ data, loading }: FunnelSectionProps) {
  const rawStages = data?.funnel?.stages
  const stages = rawStages ? filterThreeStages(rawStages) : undefined
  const totalRate = data?.funnel?.totalConversionRate
  const holdCount = data?.funnel?.holdCount ?? 0
  const holdRate = data?.funnel?.holdRate ?? 0
  const lostCount = data?.funnel?.lostCount ?? 0
  const lostRate = data?.funnel?.lostRate ?? 0

  return (
    <Card variant="glass" className="p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-foreground">전환 퍼널</h2>
        </div>
        <span className="text-xs text-muted-foreground">유입 → 전환율</span>
      </div>

      {loading ? (
        <Skeleton className="h-[120px] rounded-lg" />
      ) : stages && stages.length > 0 ? (
        <FunnelProgress
          stages={stages}
          totalRate={totalRate}
          holdCount={holdCount}
          holdRate={holdRate}
          lostCount={lostCount}
          lostRate={lostRate}
        />
      ) : (
        <EmptyState
          icon={Filter}
          title="퍼널 데이터 부족"
          description="리드가 유입되면 전환 퍼널이 자동 생성됩니다."
        />
      )}
    </Card>
  )
}

function FunnelProgress({
  stages,
  totalRate,
  holdCount,
  holdRate,
  lostCount,
  lostRate,
}: {
  stages: FunnelStage[]
  totalRate?: number
  holdCount: number
  holdRate: number
  lostCount: number
  lostRate: number
}) {
  const [tooltip, setTooltip] = useState<{
    index: number
    x: number
    y: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const insight = getMaxDropoffInsight(stages)

  return (
    <div ref={containerRef}>
      {/* 데스크탑: 수평 — 노드를 균등 배치하고 사이에 커넥터 */}
      <div className="hidden md:block relative">
        {/* 커넥터 라인 (노드 뒤에 깔리는 레이어) */}
        <div className="absolute inset-0 flex items-start" style={{ top: NODE_SIZE / 2 }}>
          <div className="w-full flex items-center px-5">
            {stages.slice(1).map((stage, i) => {
              const segColor = getSegmentColor(stages[i].count, stage.count)
              const prevStageRate =
                stages[i].count > 0
                  ? ((stage.count / stages[i].count) * 100).toFixed(1)
                  : null
              return (
                <div key={`seg-${i}`} className="flex-1 relative">
                  <div
                    className="w-full h-[3px] rounded-full"
                    style={{ background: segColor }}
                  />
                  {prevStageRate && (
                    <span
                      className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-medium tabular-nums whitespace-nowrap"
                      style={{ color: segColor }}
                    >
                      {prevStageRate}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 노드 행 (균등 배치) */}
        <div className="relative flex justify-between">
          {stages.map((stage, i) => (
            <div key={stage.stage} className="flex flex-col items-center" style={{ minWidth: NODE_SIZE + 16 }}>
              <div
                aria-label={`${stage.label}: ${stage.count}건 (리드 대비 ${stage.rate}%)`}
                className="rounded-full flex items-center justify-center font-bold text-white dark:text-white cursor-pointer
                  transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-white/20 hover:shadow-lg hover:shadow-brand-500/20
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  background: `linear-gradient(135deg, ${FUNNEL_COLORS.brand}, ${FUNNEL_COLORS.brandLight})`,
                  opacity: getNodeOpacity(stage.count),
                  fontSize: '13px',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const containerRect = containerRef.current?.getBoundingClientRect()
                  if (containerRect) {
                    setTooltip(prev => prev?.index === i ? null : {
                      index: i,
                      x: rect.left - containerRect.left + rect.width / 2,
                      y: rect.bottom - containerRect.top + 8,
                    })
                  }
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const containerRect = containerRef.current?.getBoundingClientRect()
                  if (containerRect) {
                    setTooltip({
                      index: i,
                      x: rect.left - containerRect.left + rect.width / 2,
                      y: rect.bottom - containerRect.top + 8,
                    })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {stage.count}
              </div>
              <p className="text-xs font-medium text-foreground/80 mt-2">{stage.label}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{stage.rate}%</p>
            </div>
          ))}
        </div>

        {/* 툴팁 */}
        {tooltip && stages[tooltip.index] && (
          <FunnelTooltip
            stage={stages[tooltip.index]}
            prevStage={tooltip.index > 0 ? stages[tooltip.index - 1] : undefined}
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translateX(-50%)',
              zIndex: 50,
            }}
          />
        )}
      </div>

      {/* 모바일: 수직 */}
      <div className="md:hidden space-y-0">
        {stages.map((stage, i) => {
          const segColor =
            i > 0 ? getSegmentColor(stages[i - 1].count, stage.count) : FUNNEL_COLORS.brand
          const prevStageRate =
            i > 0 && stages[i - 1].count > 0
              ? ((stage.count / stages[i - 1].count) * 100).toFixed(1)
              : null

          return (
            <div key={stage.stage}>
              {/* 커넥터 */}
              {i > 0 && (
                <div
                  className="flex items-center gap-2 py-1"
                  style={{ marginLeft: NODE_SIZE / 2 - 1.5 }}
                >
                  <div
                    className="w-[3px] h-5 rounded-full"
                    style={{ background: segColor }}
                  />
                  {prevStageRate && (
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{ color: segColor }}
                    >
                      {prevStageRate}%
                    </span>
                  )}
                </div>
              )}

              {/* 노드 행 */}
              <div className="flex items-center gap-3 py-1 rounded-lg hover:bg-muted dark:hover:bg-white/5 transition-colors duration-200 px-1 -mx-1">
                <div
                  className="rounded-full flex items-center justify-center font-bold text-white dark:text-white shrink-0"
                  style={{
                    width: NODE_SIZE,
                    height: NODE_SIZE,
                    background: `linear-gradient(135deg, ${FUNNEL_COLORS.brand}, ${FUNNEL_COLORS.brandLight})`,
                    opacity: getNodeOpacity(stage.count),
                    fontSize: '13px',
                  }}
                >
                  {stage.count}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground/90">{stage.label}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    리드 대비 {stage.rate}%
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 전체 전환율 */}
      {totalRate !== undefined && totalRate > 0 && (
        <div className="mt-5 pt-4 border-t border-border dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">전체 전환율 (유입 → 전환)</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalRate}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(totalRate, 100)}%`,
                background: `linear-gradient(90deg, ${FUNNEL_COLORS.brand}, ${FUNNEL_COLORS.positive})`,
              }}
            />
          </div>
        </div>
      )}

      {/* 보류/미전환 표시 */}
      {(holdCount > 0 || lostCount > 0) && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {holdCount > 0 && (
            <span>보류: {holdCount}건({holdRate}%)</span>
          )}
          {lostCount > 0 && (
            <span>미전환: {lostCount}건({lostRate}%)</span>
          )}
        </div>
      )}

      {/* 인사이트 */}
      {insight && (
        <p className="mt-3 text-xs text-muted-foreground">
          {insight}
        </p>
      )}
    </div>
  )
}

function FunnelTooltip({
  stage,
  prevStage,
  style,
}: {
  stage: FunnelStage
  prevStage?: FunnelStage
  style: React.CSSProperties
}) {
  const prevRate =
    prevStage && prevStage.count > 0
      ? ((stage.count / prevStage.count) * 100).toFixed(1)
      : null

  return (
    <div
      className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl pointer-events-none dark:border-white/10"
      style={style}
    >
      <p className="text-xs font-semibold text-foreground mb-1">{stage.label}</p>
      <div className="space-y-0.5 text-xs">
        <p className="text-foreground/80">
          <span className="text-muted-foreground">건수:</span>{' '}
          <span className="font-medium tabular-nums">{stage.count}건</span>
        </p>
        <p className="text-foreground/80">
          <span className="text-muted-foreground">리드 대비:</span>{' '}
          <span className="font-medium tabular-nums">{stage.rate}%</span>
        </p>
        {prevRate && (
          <p className="text-foreground/80">
            <span className="text-muted-foreground">{prevStage!.label} 대비:</span>{' '}
            <span className="font-medium tabular-nums">{prevRate}%</span>
          </p>
        )}
      </div>
    </div>
  )
}
