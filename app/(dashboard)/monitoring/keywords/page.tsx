'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClinic } from '@/components/ClinicContext'
import { EmptyState, PageHeader } from '@/components/common'

const CATEGORY_LABELS: Record<string, string> = {
  place: '네이버 플레이스',
  website: '웹사이트',
  smartblock: '스마트블록',
  related: '함께많이찾는',
}

export default function MonitoringKeywordsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user
  const { selectedClinicId, setSelectedClinicId, clinics } = useClinic()

  const [keywords, setKeywords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ keyword: '', category: 'place', url: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; keyword: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin' && user.role !== 'agency_staff') router.replace('/')
  }, [user, router])

  const fetchKeywords = async () => {
    if (!selectedClinicId) {
      setKeywords([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/monitoring/keywords?clinic_id=${selectedClinicId}`)
      const data = await res.json()
      setKeywords(Array.isArray(data) ? data : [])
    } catch {
      toast.error('키워드 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKeywords() }, [selectedClinicId])

  const handleAdd = async () => {
    if (!form.keyword.trim()) {
      toast.error('키워드를 입력해주세요.')
      return
    }
    if (!selectedClinicId) {
      toast.error('병원을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/monitoring/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_id: selectedClinicId, ...form }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ keyword: '', category: 'place', url: '' })
      setDialogOpen(false)
      toast.success('키워드가 등록되었습니다.')
      fetchKeywords()
    } catch (e: any) {
      toast.error(e.message || '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/monitoring/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success('키워드가 삭제되었습니다.')
      fetchKeywords()
    } catch (e: any) {
      toast.error(e.message || '삭제 실패')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const toggleActive = async (id: number, currentActive: boolean) => {
    try {
      const res = await fetch('/api/monitoring/keywords', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success(currentActive ? '비활성화되었습니다.' : '활성화되었습니다.')
      fetchKeywords()
    } catch (e: any) {
      toast.error(e.message || '변경 실패')
    }
  }

  if (user?.role !== 'superadmin' && user?.role !== 'agency_staff') return null

  // 카테고리별 그룹핑
  const grouped: Record<string, any[]> = {}
  for (const kw of keywords) {
    if (!grouped[kw.category]) grouped[kw.category] = []
    grouped[kw.category].push(kw)
  }

  return (
    <>
      <PageHeader icon={TrendingUp} title="키워드 관리" description="순위 모니터링 키워드 등록 및 관리" />

      {/* 병원 선택 */}
      <div className="mb-6">
        <Label className="text-xs text-muted-foreground mb-1 block">병원</Label>
        <Select
          value={selectedClinicId ? String(selectedClinicId) : '_none'}
          onValueChange={v => setSelectedClinicId(v === '_none' ? null : Number(v))}
        >
          <SelectTrigger className="w-[200px] bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none" disabled className="text-muted-foreground">병원 선택</SelectItem>
            {clinics.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키워드 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">키워드 *</Label>
              <Input
                value={form.keyword}
                onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                placeholder="검색 키워드 입력"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">카테고리 *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="place">네이버 플레이스</SelectItem>
                  <SelectItem value="website">웹사이트</SelectItem>
                  <SelectItem value="smartblock">스마트블록</SelectItem>
                  <SelectItem value="related">함께많이찾는</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com (선택)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>키워드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.keyword}&rdquo; 키워드를 삭제하시겠습니까?
              해당 키워드의 모든 순위 기록도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete() }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!selectedClinicId ? (
        <Card variant="glass" className="p-12 text-center">
          <p className="text-muted-foreground">병원을 선택해주세요.</p>
        </Card>
      ) : loading ? (
        <Card variant="glass" className="p-6">
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        </Card>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
              <Plus size={14} /> 키워드 추가
            </Button>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
              <EmptyState icon={TrendingUp} title="등록된 키워드가 없습니다." />
            </Card>
          ) : (
            Object.entries(grouped).map(([cat, items]: [string, any[]]) => (
              <Card key={cat} variant="glass" className="p-5 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{CATEGORY_LABELS[cat] || cat}</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                      <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">키워드</TableHead>
                      <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">URL</TableHead>
                      <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium w-[80px]">활성화</TableHead>
                      <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((kw: any) => (
                      <TableRow key={kw.id} className="border-b border-border dark:border-white/5">
                        <TableCell className="text-foreground">{kw.keyword}</TableCell>
                        <TableCell>
                          {kw.url ? (
                            <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-xs max-w-[200px] overflow-hidden">
                              <ExternalLink size={12} className="shrink-0" />
                              <span className="truncate">{kw.url.replace(/^https?:\/\//, '')}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={kw.is_active}
                            onCheckedChange={() => toggleActive(kw.id, kw.is_active)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => setDeleteTarget({ id: kw.id, keyword: kw.keyword })}
                            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))
          )}
        </>
      )}
    </>
  )
}
