/**
 * 차트 색상 상수 중앙 관리
 * Recharts 컴포넌트에서 사용하는 하드코딩된 hex 값을 여기서 관리
 */

/** 범용 차트 팔레트 (5색) */
export const CHART_PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'] as const

/** 의미 기반 컬러 */
export const CHART_SEMANTIC = {
  brand: '#3b82f6',
  brandLight: '#60a5fa',
  positive: '#34d399',
  positiveStrong: '#22c55e',
  negative: '#fb7185',
  negativeStrong: '#ef4444',
  warning: '#eab308',
  cpl: '#3b82f6',
  cpc: '#f59e0b',
  ctr: '#10b981',
  lead: '#34d399',
} as const

/** 파이/도넛 차트용 그라데이션 (6색) */
export const PIE_SHADES = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#8b5cf6'] as const

/** 퍼널 단계별 컬러 */
export const FUNNEL_COLORS = {
  brand: '#3b82f6',
  brandLight: '#60a5fa',
  positive: '#22c55e',
  warning: '#eab308',
  negative: '#ef4444',
} as const

/** 바 차트 최대값/기본값 */
export const BAR_COLORS = {
  max: '#3b82f6',
  default: '#93c5fd',
} as const

/** 퍼널 그라데이션 */
export const FUNNEL_GRADIENT = 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #a78bfa 100%)'
