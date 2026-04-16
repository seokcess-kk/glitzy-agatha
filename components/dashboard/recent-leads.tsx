'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ChannelBadge } from '@/components/common'
import { MessageSquare, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toUtcDate } from '@/lib/date'
import type { RecentLead } from '@/hooks/use-dashboard-data'

interface RecentLeadsProps {
  data: RecentLead[]
  loading?: boolean
}

export function RecentLeads({ data, loading }: RecentLeadsProps) {
  return (
    <Card variant="glass" className="p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-foreground">최근 리드</h2>
        </div>
        <span className="text-xs text-muted-foreground">실시간</span>
      </div>

      {loading ? (
        <div className="space-y-3 flex-1">
          {Array(4).fill(null).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : data.length > 0 ? (
        <div className="flex-1 space-y-1">
          {data.map((lead, i) => (
            <div
              key={`${lead.phoneNumber}-${i}`}
              className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-muted/50 dark:hover:bg-white/[0.03] transition-colors duration-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {lead.name}
                </span>
                {lead.utmSource && lead.utmSource !== 'Unknown' && (
                  <ChannelBadge channel={lead.utmSource} className="text-[10px] shrink-0" />
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {formatDistanceToNow(toUtcDate(lead.createdAt), { addSuffix: true, locale: ko })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="아직 문의가 없습니다"
            description="리드가 유입되면 여기에 표시됩니다."
          />
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border dark:border-white/5">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          리드 전체 보기
          <ArrowRight size={12} />
        </Link>
      </div>
    </Card>
  )
}
