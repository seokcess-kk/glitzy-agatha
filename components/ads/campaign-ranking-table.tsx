'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClient } from '@/components/ClientContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { ChannelBadge, EmptyState } from '@/components/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BarChart2, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

interface AdStatRecord {
  campaign_id: string | null
  campaign_name: string | null
  platform: string | null
  spend_amount: number
  clicks: number
  impressions: number
}

interface CampaignRow {
  campaign_name: string
  campaign_id: string | null
  platform: string | null
  spend: number
  clicks: number
  impressions: number
  cpc: number
  ctr: number
  leads: number
  cpl: number
}

type SortField = 'campaign_name' | 'spend' | 'clicks' | 'impressions' | 'cpc' | 'ctr' | 'leads' | 'cpl'
type SortDir = 'asc' | 'desc'

interface Props {
  startDate: string
  endDate: string
  platformFilter?: string
  selectedCampaignId?: string | null
  onCampaignSelect?: (campaignId: string | null) => void
}

const PAGE_SIZE = 10

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown size={12} className="ml-1 text-muted-foreground/50 inline" />
  if (sortDir === 'asc') return <ChevronUp size={12} className="ml-1 text-primary inline" />
  return <ChevronDown size={12} className="ml-1 text-primary inline" />
}

function StatusDot({ cpc, avgCpc }: { cpc: number; avgCpc: number }) {
  if (avgCpc === 0) return null
  if (cpc < avgCpc * 0.8) return <span className="w-2 h-2 rounded-full inline-block bg-emerald-500" title="평균 대비 우수" />
  if (cpc > avgCpc * 1.2) return <span className="w-2 h-2 rounded-full inline-block bg-rose-500" title="평균 대비 부진" />
  return <span className="w-2 h-2 rounded-full inline-block bg-amber-400" title="평균 수준" />
}

export default function CampaignRankingTable({ startDate, endDate, platformFilter, selectedCampaignId, onCampaignSelect }: Props) {
  const { selectedClientId } = useClient()
  const [rawData, setRawData] = useState<AdStatRecord[]>([])
  const [campaignLeadCounts, setCampaignLeadCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expanded, setExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const days = String(Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1))
      const qs = new URLSearchParams({ days })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))
      if (platformFilter) qs.set('platform', platformFilter)

      const res = await fetch(`/api/ads/stats?${qs}`)
      if (!res.ok) {
        setRawData([])
        setCampaignLeadCounts({})
        return
      }
      const json = await res.json()
      // 새 응답 구조: { stats, campaignLeadCounts } 또는 기존 배열
      if (json.stats) {
        setRawData(Array.isArray(json.stats) ? json.stats : [])
        setCampaignLeadCounts(json.campaignLeadCounts || {})
      } else {
        setRawData(Array.isArray(json) ? json : [])
        setCampaignLeadCounts({})
      }
    } catch {
      setRawData([])
      setCampaignLeadCounts({})
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClientId, platformFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggregate by campaign_name across all dates
  const aggregated = useMemo<CampaignRow[]>(() => {
    const map = new Map<string, CampaignRow>()

    for (const record of rawData) {
      const key = record.campaign_name || '(미설정)'
      const existing = map.get(key)
      if (existing) {
        existing.spend += Number(record.spend_amount) || 0
        existing.clicks += record.clicks || 0
        existing.impressions += record.impressions || 0
        if (!existing.platform && record.platform) existing.platform = record.platform
        if (!existing.campaign_id && record.campaign_id) existing.campaign_id = record.campaign_id
      } else {
        map.set(key, {
          campaign_name: key,
          campaign_id: record.campaign_id || null,
          platform: record.platform || null,
          spend: Number(record.spend_amount) || 0,
          clicks: record.clicks || 0,
          impressions: record.impressions || 0,
          cpc: 0,
          ctr: 0,
          leads: 0,
          cpl: 0,
        })
      }
    }

    // Compute derived metrics + CPL via campaignLeadCounts
    return Array.from(map.values()).map(row => {
      const leads = row.campaign_id ? (campaignLeadCounts[row.campaign_id] || 0) : 0
      return {
        ...row,
        cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
        leads,
        cpl: leads > 0 ? Math.round(row.spend / leads) : 0,
      }
    })
  }, [rawData, campaignLeadCounts])

  const avgCpc = useMemo(() => {
    const withClicks = aggregated.filter(r => r.clicks > 0)
    if (withClicks.length === 0) return 0
    return withClicks.reduce((sum, r) => sum + r.cpc, 0) / withClicks.length
  }, [aggregated])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return aggregated
    const q = search.toLowerCase()
    return aggregated.filter(r => r.campaign_name.toLowerCase().includes(q))
  }, [aggregated, search])

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const aNum = aVal as number
      const bNum = bVal as number
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
    return copy
  }, [filtered, sortField, sortDir])

  const displayed = expanded ? sorted : sorted.slice(0, PAGE_SIZE)
  const hasMore = sorted.length > PAGE_SIZE

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const thClass = 'text-[11px] text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap'

  return (
    <Card variant="glass" className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="font-semibold text-foreground shrink-0">캠페인 성과 순위</h2>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="캠페인명 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm bg-background/50"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : aggregated.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="캠페인 데이터가 없습니다"
          description="광고 데이터가 동기화되면 캠페인별 성과를 확인할 수 있습니다."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                  <TableHead className={thClass} role="columnheader" tabIndex={0} aria-sort={sortField === 'campaign_name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('campaign_name')} onKeyDown={(e) => e.key === 'Enter' && handleSort('campaign_name')}>
                    캠페인명 <SortIcon field="campaign_name" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} w-[80px]`}>매체</TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'spend' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('spend')} onKeyDown={(e) => e.key === 'Enter' && handleSort('spend')}>
                    지출 <SortIcon field="spend" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'clicks' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('clicks')} onKeyDown={(e) => e.key === 'Enter' && handleSort('clicks')}>
                    클릭 <SortIcon field="clicks" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'impressions' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('impressions')} onKeyDown={(e) => e.key === 'Enter' && handleSort('impressions')}>
                    노출 <SortIcon field="impressions" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'cpc' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('cpc')} onKeyDown={(e) => e.key === 'Enter' && handleSort('cpc')}>
                    CPC <SortIcon field="cpc" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'ctr' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('ctr')} onKeyDown={(e) => e.key === 'Enter' && handleSort('ctr')}>
                    CTR <SortIcon field="ctr" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'leads' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('leads')} onKeyDown={(e) => e.key === 'Enter' && handleSort('leads')}>
                    리드 <SortIcon field="leads" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className={`${thClass} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'cpl' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('cpl')} onKeyDown={(e) => e.key === 'Enter' && handleSort('cpl')}>
                    CPL <SortIcon field="cpl" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                      검색 결과가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map((row, idx) => (
                    <TableRow
                      key={row.campaign_name}
                      className={`border-b border-border/50 dark:border-white/[0.03] cursor-pointer transition-colors ${
                        selectedCampaignId && selectedCampaignId === row.campaign_id
                          ? 'bg-brand-600/10'
                          : idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : 'hover:bg-muted/50 dark:hover:bg-white/[0.02]'
                      }`}
                      onClick={() => onCampaignSelect?.(selectedCampaignId === row.campaign_id ? null : (row.campaign_id || null))}
                    >
                      <TableCell className="py-2.5 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <StatusDot cpc={row.cpc} avgCpc={avgCpc} />
                          <span className="text-sm text-foreground/90 truncate block" title={row.campaign_name}>
                            {row.campaign_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {row.platform ? (
                          <ChannelBadge channel={row.platform} />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        ₩{row.spend.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        <span className={
                          row.cpc > 0 && avgCpc > 0
                            ? row.cpc < avgCpc * 0.8
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : row.cpc > avgCpc * 1.2
                              ? 'text-rose-600 dark:text-rose-400 font-medium'
                              : 'text-foreground/80'
                            : 'text-muted-foreground'
                        }>
                          {row.cpc > 0 ? `₩${Math.round(row.cpc).toLocaleString()}` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.leads > 0 ? row.leads : '-'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-foreground/80">
                        {row.cpl > 0 ? `₩${row.cpl.toLocaleString()}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setExpanded(prev => !prev)}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                {expanded
                  ? '접기'
                  : `전체 ${sorted.length}건 보기`}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
