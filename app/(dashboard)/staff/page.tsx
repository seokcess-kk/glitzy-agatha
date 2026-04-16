'use client'
import { useState, useEffect } from 'react'
import { Plus, UserCog } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/date'
import { EmptyState, PageHeader } from '@/components/common'

export default function StaffPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'clinic_admin') router.replace('/')
  }, [user, router])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/staff')
      const data = await res.json()
      setStaff(Array.isArray(data) ? data : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  const handleSave = async () => {
    if (!form.username || !form.password) {
      toast.error('아이디와 비밀번호를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ username: '', password: '' })
      setDialogOpen(false)
      toast.success('담당자 계정이 생성되었습니다.')
      fetchStaff()
    } catch (e: any) {
      toast.error(e.message || '생성 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggleStaff = async (id: number, is_active: boolean) => {
    try {
      const res = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !is_active }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success(is_active ? '계정이 비활성화되었습니다.' : '계정이 활성화되었습니다.')
      fetchStaff()
    } catch (e: any) {
      toast.error(e.message || '상태 변경 실패')
    }
  }

  if (user?.role !== 'clinic_admin') return null

  return (
    <>
      <PageHeader icon={UserCog} title="담당자 관리" description="병원 담당자 계정 생성 및 관리" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당자 계정 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">아이디 *</Label>
              <Input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="영문, 숫자, 밑줄 (3-30자)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">비밀번호 *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="8자 이상"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              생성된 계정은 예약/결제, 고객 조회, 캠페인 리드 메뉴에만 접근할 수 있습니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '생성 중...' : '계정 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">담당자 목록 ({staff.length})</h2>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 담당자 추가
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : staff.length === 0 ? (
          <EmptyState icon={UserCog} title="등록된 담당자가 없습니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                {['아이디', '생성일', '활성화'].map(h => (
                  <TableHead key={h} className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s: any) => (
                <TableRow key={s.id} className="border-b border-border dark:border-white/5">
                  <TableCell className="text-foreground font-medium">{s.username}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(s.created_at)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={() => toggleStaff(s.id, s.is_active)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
