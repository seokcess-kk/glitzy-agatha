'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface LoginLog {
  id: number
  user_id: number | null
  username: string
  ip_address: string | null
  user_agent: string | null
  success: boolean
  failure_reason: string | null
  created_at: string
}

export default function LoginLogsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [logs, setLogs] = useState<LoginLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('')
  const limit = 30

  // superadmin 가드
  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('username', search)
      if (filter) params.set('success', filter)

      const res = await fetch(`/api/admin/login-logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, search, filter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (user?.role !== 'superadmin') return null

  const totalPages = Math.ceil(total / limit)

  const formatDate = (iso: string) => {
    const s = iso.trim()
    const d = (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) ? new Date(s) : new Date(s + 'Z')
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const failureLabel = (reason: string | null) => {
    switch (reason) {
      case 'rate_limited': return '시도 횟수 초과'
      case 'user_not_found': return '사용자 없음'
      case 'invalid_password': return '비밀번호 오류'
      default: return reason || '알 수 없음'
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="로그인 로그"
        description="모든 로그인 시도 이력을 확인합니다."
        icon={Shield}
      />

      {/* 필터 */}
      <Card variant="glass" className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="아이디 검색"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === '' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setFilter(''); setPage(1) }}
            >
              전체
            </Button>
            <Button
              variant={filter === 'true' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setFilter('true'); setPage(1) }}
            >
              성공
            </Button>
            <Button
              variant={filter === 'false' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setFilter('false'); setPage(1) }}
            >
              실패
            </Button>
          </div>
          <p className="text-xs text-muted-foreground ml-auto">총 {total}건</p>
        </div>
      </Card>

      {/* 테이블 */}
      <Card variant="glass" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">시간</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">아이디</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">결과</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">사유</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border dark:border-white/5 hover:bg-muted/30 dark:hover:bg-white/[0.02]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">로그인 기록이 없습니다.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-border dark:border-white/5 hover:bg-muted/30 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{log.username}</td>
                    <td className="px-4 py-3">
                      <Badge variant={log.success ? 'success' : 'destructive'}>
                        {log.success ? '성공' : '실패'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.success ? '-' : failureLabel(log.failure_reason)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.ip_address || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border dark:border-white/5">
            <p className="text-xs text-muted-foreground">{page} / {totalPages} 페이지</p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
