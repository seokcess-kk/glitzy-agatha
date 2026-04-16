'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/components/charts'
import { getChannelColor } from '@/lib/channel-colors'
import { ChartTooltipProps } from '@/types/recharts'

interface ChannelData {
  channel: string
  leads: number
}

interface PageChannelBreakdown {
  landingPageId: number
  name: string
  channels: ChannelData[]
}

interface Props {
  channelBreakdown: PageChannelBreakdown[]
}

function ChannelTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const filtered = payload.filter((p) => p.value > 0)
  if (filtered.length === 0) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm max-w-[200px]">
      <p className="font-medium text-foreground/80 mb-1.5 truncate">{label}</p>
      {filtered.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          <span style={{ color: p.color }}>●</span>{' '}
          {p.name}: <span className="text-foreground font-medium">{p.value}건</span>
        </p>
      ))}
    </div>
  )
}

export default function LandingPageChannelBreakdown({ channelBreakdown }: Props) {
  // 상위 6개 LP만 표시
  const topPages = useMemo(() => channelBreakdown.slice(0, 6), [channelBreakdown])

  // 모든 채널 수집 → 상위 5개 + 기타
  const { allChannels, chartData } = useMemo(() => {
    const channelTotals: Record<string, number> = {}
    for (const page of topPages) {
      for (const ch of page.channels) {
        channelTotals[ch.channel] = (channelTotals[ch.channel] || 0) + ch.leads
      }
    }

    const sorted = Object.entries(channelTotals).sort((a, b) => b[1] - a[1])
    const topChannels = sorted.slice(0, 5).map(([ch]) => ch)
    const hasOther = sorted.length > 5

    const channels = hasOther ? [...topChannels, '기타'] : topChannels

    const data = topPages.map(page => {
      const entry: Record<string, string | number> = { name: page.name }
      const channelLookup = new Map(page.channels.map(c => [c.channel, c.leads]))

      for (const ch of topChannels) {
        entry[ch] = channelLookup.get(ch) || 0
      }
      if (hasOther) {
        let otherSum = 0
        for (const ch of page.channels) {
          if (!topChannels.includes(ch.channel)) {
            otherSum += ch.leads
          }
        }
        entry['기타'] = otherSum
      }
      return entry
    })

    return { allChannels: channels, chartData: data }
  }, [topPages])

  if (channelBreakdown.length === 0 || allChannels.length === 0) return null

  const barHeight = topPages.length * 44 + 20

  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="font-semibold text-foreground shrink-0">랜딩페이지 유입 채널</h2>
        <span className="text-xs text-muted-foreground">UTM Source 기준</span>
      </div>

      <ResponsiveContainer width="100%" height={barHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip content={<ChannelTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 11,
              color: 'hsl(var(--muted-foreground))',
              paddingBottom: 8,
            }}
          />
          {allChannels.map(ch => (
            <Bar
              key={ch}
              dataKey={ch}
              name={ch}
              stackId="stack"
              fill={ch === '기타' ? '#94a3b8' : getChannelColor(ch)}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
