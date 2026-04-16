'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from '@/components/charts'
import { getChannelColor } from '@/lib/channel-colors'
import { ChartTooltipProps } from '@/types/recharts'

interface ChannelRow {
  channel: string
  revenue: number
}

interface Props {
  byChannel: ChannelRow[]
}

function RevenueTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  if (!d) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-medium text-foreground/80 mb-1">{d.name}</p>
      <p className="text-muted-foreground">
        매출: <span className="text-foreground font-medium">₩{Number(d.value).toLocaleString()}</span>
      </p>
    </div>
  )
}

export default function ChannelRevenueChart({ byChannel }: Props) {
  const chartData = useMemo(() => {
    const sorted = [...byChannel].filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue)
    if (sorted.length <= 5) return sorted

    const top5 = sorted.slice(0, 5)
    const others = sorted.slice(5).reduce((sum, c) => sum + c.revenue, 0)
    if (others > 0) top5.push({ channel: '기타', revenue: others })
    return top5
  }, [byChannel])

  if (chartData.length === 0) return null

  return (
    <Card variant="glass" className="p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">채널별 매출 비중</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="revenue"
            nameKey="channel"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {chartData.map((entry) => (
              <Cell key={entry.channel} fill={getChannelColor(entry.channel)} />
            ))}
          </Pie>
          <Tooltip content={<RevenueTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}
