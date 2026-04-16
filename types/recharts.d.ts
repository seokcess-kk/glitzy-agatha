/**
 * Recharts 커스텀 툴팁/라벨 공용 타입
 */

export interface ChartTooltipPayloadItem {
  value: number
  name: string
  color: string
  dataKey: string
  payload: Record<string, unknown>
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
  label?: string
}

export interface ChartLabelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number | string
  index?: number
  payload?: Record<string, unknown>
}
