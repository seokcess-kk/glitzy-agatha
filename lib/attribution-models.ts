/**
 * 멀티터치 어트리뷰션 모델
 * - first: 퍼스트터치 (첫 터치에 100%)
 * - linear: 균등 배분 (모든 터치에 동일 비율)
 * - time-decay: 시간 가중 (결제일에 가까울수록 높은 가중치)
 */

export interface TouchPoint {
  channel: string
  campaign: string | null
  date: string // ISO date
}

export interface AttributionWeight {
  channel: string
  campaign: string | null
  weight: number // 0~1 사이, 합계 = 1
}

export type AttributionModel = 'first' | 'linear' | 'time-decay'

/**
 * 동일 채널+캠페인 터치포인트의 가중치를 합산
 */
function mergeWeights(weights: AttributionWeight[]): AttributionWeight[] {
  const map = new Map<string, AttributionWeight>()
  for (const w of weights) {
    const key = `${w.channel}::${w.campaign ?? ''}`
    const existing = map.get(key)
    if (existing) {
      existing.weight += w.weight
    } else {
      map.set(key, { channel: w.channel, campaign: w.campaign, weight: w.weight })
    }
  }
  return Array.from(map.values())
}

/**
 * 퍼스트터치: 첫 터치에 100%
 */
export function firstTouchAttribution(touchpoints: TouchPoint[]): AttributionWeight[] {
  if (touchpoints.length === 0) return []
  const first = touchpoints[0]
  return [{ channel: first.channel, campaign: first.campaign, weight: 1 }]
}

/**
 * 균등 배분: 모든 터치에 동일 비율
 */
export function linearAttribution(touchpoints: TouchPoint[]): AttributionWeight[] {
  if (touchpoints.length === 0) return []
  const weight = 1 / touchpoints.length
  const weights = touchpoints.map(tp => ({
    channel: tp.channel,
    campaign: tp.campaign,
    weight,
  }))
  return mergeWeights(weights)
}

/**
 * 시간 가중: 결제일(마지막 이벤트)에 가까울수록 높은 가중치
 * halfLifeDays: 반감기 (기본 7일). 7일 전 터치포인트의 가중치는 최신의 50%
 */
export function timeDecayAttribution(touchpoints: TouchPoint[], halfLifeDays = 7): AttributionWeight[] {
  if (touchpoints.length === 0) return []
  if (touchpoints.length === 1) {
    return [{ channel: touchpoints[0].channel, campaign: touchpoints[0].campaign, weight: 1 }]
  }

  // 가장 최근 터치포인트 기준으로 decay 계산
  const latestDate = Math.max(...touchpoints.map(tp => new Date(tp.date).getTime()))
  const decayRate = Math.LN2 / (halfLifeDays * 86400000) // per millisecond

  const rawWeights = touchpoints.map(tp => {
    const age = latestDate - new Date(tp.date).getTime()
    return Math.exp(-decayRate * age)
  })

  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0)

  const weights = touchpoints.map((tp, i) => ({
    channel: tp.channel,
    campaign: tp.campaign,
    weight: rawWeights[i] / totalWeight,
  }))

  return mergeWeights(weights)
}

/**
 * 통합 인터페이스
 */
export function applyAttributionModel(
  model: AttributionModel,
  touchpoints: TouchPoint[],
  halfLifeDays?: number
): AttributionWeight[] {
  switch (model) {
    case 'first':
      return firstTouchAttribution(touchpoints)
    case 'linear':
      return linearAttribution(touchpoints)
    case 'time-decay':
      return timeDecayAttribution(touchpoints, halfLifeDays)
    default:
      return firstTouchAttribution(touchpoints)
  }
}
