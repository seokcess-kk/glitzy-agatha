'use client'

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// Re-export Recharts 자식 컴포넌트 (dynamic import 불필요)
export {
  Area,
  Bar,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

// 로딩 컴포넌트
const ChartLoading = () => (
  <div className="h-64 w-full flex items-center justify-center">
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
)

// 주요 차트 컨테이너만 Dynamic Import (번들 분리 효과)
export const AreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart),
  { ssr: false, loading: () => <ChartLoading /> }
) as ComponentType<any>

export const BarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { ssr: false, loading: () => <ChartLoading /> }
) as ComponentType<any>

export const PieChart = dynamic(
  () => import('recharts').then(mod => mod.PieChart),
  { ssr: false, loading: () => <ChartLoading /> }
) as ComponentType<any>

export const LineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  { ssr: false, loading: () => <ChartLoading /> }
) as ComponentType<any>

export const ComposedChart = dynamic(
  () => import('recharts').then(mod => mod.ComposedChart),
  { ssr: false, loading: () => <ChartLoading /> }
) as ComponentType<any>

export const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false }
) as ComponentType<any>

// 로딩 컴포넌트 export
export { ChartLoading }
