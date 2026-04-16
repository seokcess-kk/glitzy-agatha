'use client'
import { useState, useEffect } from 'react'
import { Plus, UserCog, Settings } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { EmptyState } from '@/components/common'
import { PageHeader } from '@/components/common'

const ROLE_LABELS: Record<string, string> = {
  superadmin: '슈퍼어드민',
  client_admin: '클라이언트 관리자',
  client_staff: '클라이언트 담당자',
  agency_staff: '에이전시 담당자',
}

const MENU_OPTIONS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'campaigns', label: '캠페인 리드' },
  { key: 'leads', label: '고객(CDP)' },
  { key: 'patients', label: '예약/결제' },
  { key: 'chatbot', label: '챗봇 현황' },
  { key: 'ads', label: '광고 성과' },
  { key: 'content', label: '콘텐츠 분석' },
  { key: 'monitor', label: '콘텐츠 모니터링' },
  { key: 'press', label: '언론보도' },
  { key: 'monitoring', label: '순위 현황' },
  { key: 'medichecker', label: '원고 검수' },
  { key: 'erp-documents', label: '견적/계산서' },
]

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [users, setUsers] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [permDialogOpen, setPermDialogOpen] = useState(false)
  const [permUserId, setPermUserId] = useState<number | null>(null)
  const [permClientIds, setPermClientIds] = useState<number[]>([])
  const [permMenuKeys, setPermMenuKeys] = useState<string[]>([])
  const [permSaving, setPermSaving] = useState(false)
  const [form, setForm] = useState({
    username: '', password: '', role: 'client_admin', client_id: '',
    assigned_client_ids: [] as number[], menu_permissions: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [uRes, cRes] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/clients').then(r => r.json()),
      ])
      setUsers(Array.isArray(uRes) ? uRes : [])
      setClients(Array.isArray(cRes) ? cRes : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!form.username || !form.password) {
      toast.error('아이디와 비밀번호를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        username: form.username,
        password: form.password,
        role: form.role,
        client_id: form.client_id ? Number(form.client_id) : null,
      }
      if (form.role === 'agency_staff') {
        body.assigned_client_ids = form.assigned_client_ids
        body.menu_permissions = form.menu_permissions
      }
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ username: '', password: '', role: 'client_admin', client_id: '', assigned_client_ids: [], menu_permissions: [] })
      setDialogOpen(false)
      toast.success('계정이 생성되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '생성 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggleUser = async (id: number, is_active: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !is_active }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success(is_active ? '계정이 비활성화되었습니다.' : '계정이 활성화되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '상태 변경 실패')
    }
  }

  const openPermDialog = async (userId: number) => {
    setPermUserId(userId)
    setPermSaving(true)
    setPermDialogOpen(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`)
      if (res.ok) {
        const data = await res.json()
        setPermClientIds(data.assigned_client_ids || [])
        setPermMenuKeys(data.menu_permissions || [])
      }
    } catch {
      toast.error('권한 로드 실패')
    } finally {
      setPermSaving(false)
    }
  }

  const savePermissions = async () => {
    if (!permUserId) return
    setPermSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${permUserId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_client_ids: permClientIds, menu_permissions: permMenuKeys }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success('권한이 저장되었습니다.')
      setPermDialogOpen(false)
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setPermSaving(false)
    }
  }

  const toggleClientId = (id: number, list: number[], setter: (v: number[]) => void) => {
    setter(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const toggleMenuKey = (key: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(key) ? list.filter(x => x !== key) : [...list, key])
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <PageHeader icon={UserCog} title="계정 관리" description="사용자 계정 생성 및 권한 관리" />

      {/* 계정 생성 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>신규 계정 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">아이디 *</Label>
                <Input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="로그인 아이디"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">비밀번호 *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="초기 비밀번호"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">역할 *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v, client_id: '', assigned_client_ids: [], menu_permissions: [] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_staff">클라이언트 담당자</SelectItem>
                  <SelectItem value="client_admin">클라이언트 관리자</SelectItem>
                  <SelectItem value="agency_staff">에이전시 담당자</SelectItem>
                  <SelectItem value="superadmin">슈퍼어드민</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* client_admin / client_staff: 단일 클라이언트 선택 */}
            {(form.role === 'client_admin' || form.role === 'client_staff') && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">담당 클라이언트 *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* agency_staff: 다중 클라이언트 + 메뉴 권한 */}
            {form.role === 'agency_staff' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">배정 클라이언트 * (복수 선택)</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border dark:border-white/10 rounded-lg p-3">
                    {clients.map((c: any) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer hover:text-foreground">
                        <Checkbox
                          checked={form.assigned_client_ids.includes(c.id)}
                          onCheckedChange={() => toggleClientId(c.id, form.assigned_client_ids, (v) => setForm(f => ({ ...f, assigned_client_ids: v })))}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">메뉴 권한 (미선택 시 전체 허용)</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border dark:border-white/10 rounded-lg p-3">
                    {MENU_OPTIONS.map(m => (
                      <label key={m.key} className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer hover:text-foreground">
                        <Checkbox
                          checked={form.menu_permissions.includes(m.key)}
                          onCheckedChange={() => toggleMenuKey(m.key, form.menu_permissions, (v) => setForm(f => ({ ...f, menu_permissions: v })))}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '생성 중...' : '계정 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 권한 수정 다이얼로그 */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>권한 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">배정 클라이언트</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border dark:border-white/10 rounded-lg p-3">
                {clients.map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={permClientIds.includes(c.id)}
                      onCheckedChange={() => toggleClientId(c.id, permClientIds, setPermClientIds)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">메뉴 권한 (미선택 시 전체 허용)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border dark:border-white/10 rounded-lg p-3">
                {MENU_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer hover:text-foreground">
                    <Checkbox
                      checked={permMenuKeys.includes(m.key)}
                      onCheckedChange={() => toggleMenuKey(m.key, permMenuKeys, setPermMenuKeys)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPermDialogOpen(false)}>취소</Button>
            <Button onClick={savePermissions} disabled={permSaving} className="bg-brand-600 hover:bg-brand-700">
              {permSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">계정 목록 ({users.length})</h2>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 계정 생성
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : users.length === 0 ? (
          <EmptyState icon={UserCog} title="등록된 계정이 없습니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                {['아이디', '역할', '담당 클라이언트', '생성일', '활성화', '관리'].map(h => (
                  <TableHead key={h} className="text-xs text-muted-foreground font-medium">{h === '관리' ? '' : h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
              <TableRow key={u.id} className="border-b border-border dark:border-white/5">
                <TableCell className="text-foreground font-medium">{u.username}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.role === 'superadmin' ? 'default' : u.role === 'agency_staff' ? 'warning' : 'info'}
                    className={
                      u.role === 'superadmin' ? 'bg-purple-500/20 text-purple-400 border-0' :
                      u.role === 'agency_staff' ? 'bg-orange-500/20 text-orange-400 border-0' :
                      u.role === 'client_staff' ? 'bg-muted text-muted-foreground border-0' : ''
                    }
                  >
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{u.client?.name || (u.role === 'agency_staff' ? '다중 배정' : '-')}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(u.created_at)}</TableCell>
                <TableCell>
                  <Switch
                    checked={u.is_active}
                    onCheckedChange={() => toggleUser(u.id, u.is_active)}
                  />
                </TableCell>
                <TableCell>
                  {u.role === 'agency_staff' && (
                    <button
                      onClick={() => openPermDialog(u.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="권한 설정"
                    >
                      <Settings size={16} />
                    </button>
                  )}
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
