/**
 * 차트 색상 상수 중앙 관리
 * Recharts 컴포넌트에서 사용하는 하드코딩된 hex 값을 여기서 관리
 */

/** 범용 차트 팔레트 (6색) */
export const CHART_COLORS = [
  '#7C3AED', // Violet
  '#06B6D4', // Cyan
  '#D97706', // Amber
  '#0D9488', // Teal
  '#E11D48', // Rose
  '#64748B', // Slate
] as const

/** 범용 차트 팔레트 (레거시 alias) */
export const CHART_PALETTE = CHART_COLORS

/** 의미 기반 컬러 */
export const CHART_SEMANTIC = {
  brand: '#7C3AED',
  brandLight: '#A78BFA',
  positive: '#34d399',
  positiveStrong: '#22c55e',
  negative: '#fb7185',
  negativeStrong: '#ef4444',
  warning: '#eab308',
  cpl: '#7C3AED',
  cpc: '#D97706',
  ctr: '#0D9488',
  lead: '#34d399',
} as const

/** 파이/도넛 차트용 그라데이션 (6색) */
export const PIE_SHADES = ['#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#EDE9FE', '#06B6D4'] as const

/** 퍼널 단계별 컬러 */
export const FUNNEL_COLORS = {
  brand: '#7C3AED',
  brandLight: '#A78BFA',
  positive: '#22c55e',
  warning: '#eab308',
  negative: '#ef4444',
} as const

/** 바 차트 최대값/기본값 */
export const BAR_COLORS = {
  max: '#7C3AED',
  default: '#C4B5FD',
} as const

/** 퍼널 그라데이션 */
export const FUNNEL_GRADIENT = 'linear-gradient(90deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)'
