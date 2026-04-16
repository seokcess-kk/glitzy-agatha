'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useClient } from '@/components/ClientContext'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChannelBadge, EmptyState } from '@/components/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { ImageOff, Film, Image, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

function getCreativeUrl(fileName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/creatives/${fileName}`
}

interface CreativeData {
  utm_content: string
  name: string
  platform: string | null
  spend: number
  clicks: number
  impressions: number
  cpc: number
  ctr: number
  cpl: number
  leads: number
  contacts: number
  revenue: number
  conversionRate: number
  registered: boolean
  file_name: string | null
  file_type: string | null
  campaign_ids?: string[]
}

interface CreativePerformanceResponse {
  creatives: CreativeData[]
}

type SortField = 'spend' | 'impressions' | 'clicks' | 'cpc' | 'ctr' | 'leads' | 'cpl'

const PAGE_SIZE = 10

interface Props {
  startDate: string
  endDate: string
  campaignFilter?: string | null
}

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: 'asc' | 'desc' }) {
  if (field !== current) return <ChevronsUpDown size={10} className="ml-0.5 text-muted-foreground/50 inline" />
  if (dir === 'asc') return <ChevronUp size={10} className="ml-0.5 text-primary inline" />
  return <ChevronDown size={10} className="ml-0.5 text-primary inline" />
}

function fmtShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).replace(/\.$/, '')
}

export default function CreativePerformance({ startDate, endDate, campaignFilter }: Props) {
  const { selectedClientId } = useClient()
  const [data, setData] = useState<CreativePerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [viewerType, setViewerType] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('leads')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (selectedClientId) qs.set('client_id', String(selectedClientId))

      const res = await fetch(`/api/ads/creatives-performance?${qs}`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedClientId])

  useEffect(() => { fetchData() }, [fetchData])

  const creatives = useMemo(() => data?.creatives || [], [data])

  // 캠페인 필터 적용
  const filtered = useMemo(() => {
    if (!campaignFilter) return creatives
    return creatives.filter(c => c.campaign_ids?.includes(campaignFilter))
  }, [creatives, campaignFilter])

  // 캠페인 필터 변경 시 페이지네이션 리셋
  useEffect(() => { setExpanded(false) }, [campaignFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const aVal = a[sortField] as number
      const bVal = b[sortField] as number
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
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

  const thBase = 'text-[11px] text-muted-foreground font-medium whitespace-nowrap'
  const thSort = `${thBase} cursor-pointer select-none hover:text-foreground transition-colors`

  return (
    <>
    <Card variant="glass" className="p-5 md:p-6 mt-6">
      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground shrink-0">소재별 성과</h2>
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {campaignFilter ? `${filtered.length}건 (필터)` : `${filtered.length}건`}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{fmtShort(startDate)} ~ {fmtShort(endDate)}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title={campaignFilter ? '해당 캠페인의 소재가 없습니다' : '소재별 성과 데이터가 없습니다'}
          description={campaignFilter ? '다른 캠페인을 선택하거나 필터를 해제해주세요.' : '광고 소재 관리에서 소재를 등록하고 utm_content가 포함된 리드가 유입되면 성과를 확인할 수 있습니다.'}
        />
      ) : (
        <>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className={`${thBase} w-14 px-2`}>소재</TableHead>
                <TableHead className={thBase}>소재명</TableHead>
                <TableHead className={`${thBase} w-[70px]`}>플랫폼</TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'spend' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('spend')} onKeyDown={(e) => e.key === 'Enter' && handleSort('spend')}>
                  지출 <SortIcon field="spend" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'impressions' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('impressions')} onKeyDown={(e) => e.key === 'Enter' && handleSort('impressions')}>
                  노출 <SortIcon field="impressions" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'clicks' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('clicks')} onKeyDown={(e) => e.key === 'Enter' && handleSort('clicks')}>
                  클릭 <SortIcon field="clicks" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'cpc' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('cpc')} onKeyDown={(e) => e.key === 'Enter' && handleSort('cpc')}>
                  CPC <SortIcon field="cpc" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'ctr' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('ctr')} onKeyDown={(e) => e.key === 'Enter' && handleSort('ctr')}>
                  CTR <SortIcon field="ctr" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'leads' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('leads')} onKeyDown={(e) => e.key === 'Enter' && handleSort('leads')}>
                  리드 <SortIcon field="leads" current={sortField} dir={sortDir} />
                </TableHead>
                <TableHead className={`${thSort} text-right`} role="columnheader" tabIndex={0} aria-sort={sortField === 'cpl' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort('cpl')} onKeyDown={(e) => e.key === 'Enter' && handleSort('cpl')}>
                  CPL <SortIcon field="cpl" current={sortField} dir={sortDir} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((row, idx) => (
                <TableRow
                  key={row.utm_content}
                  className={`border-b border-border/50 dark:border-white/[0.03] ${idx % 2 === 1 ? 'bg-muted/30 dark:bg-white/[0.01]' : ''}`}
                >
                  <TableCell className="py-2 px-2">
                    <div
                      className={`w-9 h-9 shrink-0 ${row.file_name ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (row.file_name) {
                          setViewerSrc(getCreativeUrl(row.file_name))
                          setViewerType(row.file_type)
                          setViewerOpen(true)
                        }
                      }}
                    >
                      {row.file_name ? (
                        row.file_type?.startsWith('video/') ? (
                          <div className="w-9 h-9 rounded-md bg-muted dark:bg-white/5 overflow-hidden relative">
                            <video src={getCreativeUrl(row.file_name)} className="w-full h-full object-cover" muted preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors">
                              <Film size={11} className="text-white/80" />
                            </div>
                          </div>
                        ) : (
                          <img src={getCreativeUrl(row.file_name)} alt={row.name} className="w-9 h-9 rounded-md object-cover bg-muted dark:bg-white/5 hover:opacity-80 transition-opacity" />
                        )
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-muted dark:bg-white/5 flex items-center justify-center text-muted-foreground/40">
                          <Image size={13} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3" title={row.utm_content}>
                    <span className={`text-sm truncate block ${row.registered ? 'text-foreground/90' : 'text-muted-foreground italic'}`}>
                      {row.name}
                    </span>
                    {!row.registered && (
                      <span className="text-xs text-muted-foreground/60">미등록</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {row.platform ? <ChannelBadge channel={row.platform} /> : <span className="text-muted-foreground text-xs">-</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm text-foreground/80">
                    {row.spend > 0 ? `₩${row.spend.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm text-foreground/80">
                    {row.impressions > 0 ? row.impressions.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm text-foreground/80">
                    {row.clicks > 0 ? row.clicks.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm text-foreground/80">
                    {row.cpc > 0 ? `₩${row.cpc.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm text-foreground/80">
                    {row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm font-medium text-foreground">
                    {row.leads > 0 ? row.leads : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3 text-sm text-foreground/80">
                    {row.cpl > 0 ? `₩${row.cpl.toLocaleString()}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

          {hasMore && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setExpanded(prev => !prev)}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer"
              >
                {expanded ? '접기' : `전체 ${sorted.length}건 보기`}
              </button>
            </div>
          )}
        </>
      )}
    </Card>

    {/* 소재 원본 보기 모달 */}
    <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
      <DialogContent className="max-w-4xl p-2 bg-black/90 border-border dark:border-white/10">
        {viewerSrc && (
          viewerType?.startsWith('video/') ? (
            <video src={viewerSrc} className="w-full max-h-[80vh] object-contain rounded-lg" controls autoPlay muted />
          ) : (
            <img src={viewerSrc} alt="소재 원본" className="w-full max-h-[80vh] object-contain rounded-lg" />
          )
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
