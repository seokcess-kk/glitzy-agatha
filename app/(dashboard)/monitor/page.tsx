'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Scan, AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, StatsCard } from '@/components/common'
import { formatDate } from '@/lib/date'

const RISK_CONFIG = {
  safe:    { label: '안전',  variant: 'success' as const, bar: 'bg-emerald-500' },
  caution: { label: '주의',  variant: 'warning' as const, bar: 'bg-yellow-500'  },
  danger:  { label: '위험',  variant: 'destructive' as const, bar: 'bg-red-500'     },
}

const PLATFORM_VARIANTS: Record<string, "meta" | "google" | "tiktok" | "naver" | "dable" | "secondary"> = {
  Instagram: 'meta',
  YouTube:   'google',
  TikTok:    'tiktok',
  Naver:     'naver',
  Dable:     'dable',
}

function AuditRow({ post, onAnalyze }: { post: any; onAnalyze: (id: number) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const audit = post.audit

  const handleAnalyze = async () => {
    setAnalyzing(true)
    await onAnalyze(post.id)
    setAnalyzing(false)
  }

  const riskCfg = audit ? (RISK_CONFIG[audit.risk_level as keyof typeof RISK_CONFIG] || RISK_CONFIG.safe) : null

  return (
    <>
      <TableRow className="border-b border-border dark:border-white/5 hover:bg-muted dark:hover:bg-white/[0.03]">
        <TableCell>
          <Badge variant={PLATFORM_VARIANTS[post.platform] || 'secondary'}>{post.platform}</Badge>
        </TableCell>
        <TableCell>
          <p className="text-sm text-foreground/80 truncate max-w-[280px]">{post.post_title}</p>
          {post.utm_campaign && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">{post.utm_campaign}</p>
          )}
        </TableCell>
        <TableCell>
          {riskCfg ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted dark:bg-white/5 rounded-full overflow-hidden w-20">
                <div
                  className={`h-full rounded-full ${riskCfg.bar}`}
                  style={{ width: `${audit.risk_score}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-8">{audit.risk_score}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/60">미분석</span>
          )}
        </TableCell>
        <TableCell>
          {riskCfg ? (
            <Badge variant={riskCfg.variant}>{riskCfg.label}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground/60">—</span>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {audit?.analyzed_at ? formatDate(audit.analyzed_at) : '—'}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="glass"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="text-xs"
            >
              {analyzing ? <RefreshCw size={11} className="animate-spin" /> : <Scan size={11} />}
              {analyzing ? '분석 중...' : '분석'}
            </Button>
            {audit?.findings?.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={expanded ? '결과 접기' : '결과 펼치기'}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && audit && (
        <TableRow className="border-b border-border dark:border-white/5 bg-muted/30 dark:bg-white/[0.02]">
          <TableCell colSpan={6} className="px-4 py-4">
            {audit.summary && (
              <p className="text-sm text-foreground/80 mb-3 italic">"{audit.summary}"</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(audit.findings || []).map((f: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${f.detected ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${f.detected ? 'bg-red-400' : 'bg-emerald-500'}`} />
                  <div>
                    <p className={`text-xs font-semibold mb-0.5 ${f.detected ? 'text-red-400' : 'text-muted-foreground'}`}>{f.category}</p>
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function MonitorPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  const { selectedClinicId } = useClinic()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRisk, setFilterRisk] = useState<string>('all')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const data = await fetch(`/api/content/audit${qs}`).then(r => r.json())
      setPosts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleAnalyze = async (postId: number) => {
    await fetch('/api/content/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    })
    await fetchPosts()
  }

  const dangerPosts = posts.filter(p => p.audit?.risk_level === 'danger')
  const cautionPosts = posts.filter(p => p.audit?.risk_level === 'caution')
  const safePosts  = posts.filter(p => p.audit?.risk_level === 'safe')

  const filtered = filterRisk === 'all' ? posts
    : filterRisk === 'unanalyzed' ? posts.filter(p => !p.audit)
    : posts.filter(p => p.audit?.risk_level === filterRisk)

  const FILTERS = [
    { key: 'all',        label: '전체',     count: posts.length },
    { key: 'danger',     label: '위험',     count: dangerPosts.length },
    { key: 'caution',    label: '주의',     count: cautionPosts.length },
    { key: 'safe',       label: '안전',     count: safePosts.length },
    { key: 'unanalyzed', label: '미분석',   count: posts.filter(p => !p.audit).length },
  ]

  return (
    <>
      <PageHeader
        title="콘텐츠 모니터링"
        description="네이버 블로그 · 인스타그램 피드 텍스트의 의료광고법 저촉 여부를 AI로 분석합니다."
        actions={
          <Button variant="glass" size="icon" onClick={fetchPosts} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
        }
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: '총 콘텐츠',  value: posts.length,         color: 'text-foreground' },
          { label: '위험',       value: dangerPosts.length,   color: 'text-red-400' },
          { label: '주의',       value: cautionPosts.length,  color: 'text-yellow-400' },
          { label: '안전',       value: safePosts.length,     color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} variant="glass" className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            {loading ? <Skeleton className="h-7 w-12" /> : <p className={`text-xl md:text-2xl font-bold ${color}`}>{value}</p>}
          </Card>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map(f => (
          <Button
            key={f.key}
            variant={filterRisk === f.key ? 'default' : 'glass'}
            size="sm"
            onClick={() => setFilterRisk(f.key)}
            className={filterRisk === f.key ? 'bg-brand-600' : ''}
          >
            {f.label}
            <span className={`ml-1.5 ${filterRisk === f.key ? 'opacity-70' : 'text-muted-foreground/60'}`}>({f.count})</span>
          </Button>
        ))}
      </div>

      {/* 포스트 테이블 */}
      <Card variant="glass" className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Scan size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-1">콘텐츠가 없습니다.</p>
            <p className="text-xs">브랜드 콘텐츠 분석 메뉴에서 포스트를 먼저 등록하세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[540px]">
              <TableHeader>
                <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                  {['플랫폼', '콘텐츠 제목', '위험도 점수', '등급', '마지막 분석', '액션'].map(h => (
                    <TableHead key={h} className="text-xs text-muted-foreground uppercase tracking-wider font-medium whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(post => (
                  <AuditRow key={post.id} post={post} onAnalyze={handleAnalyze} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  )
}
