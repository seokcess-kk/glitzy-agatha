'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Building2, Bell, Pencil, X, Settings2, Search, Link2 } from 'lucide-react'
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
import ClientApiConfigDialog from '@/components/admin/ClientApiConfigDialog'
import { API_CONFIG_PLATFORMS, API_PLATFORM_SHORT, type ApiPlatform } from '@/lib/platform'

type Platform = ApiPlatform

type ErpLinkMode = 'select' | 'create' | 'later'

interface ErpSearchResult {
  id: string
  name: string
  branch_name?: string | null
  business_number?: string
}

function erpDisplayName(item: ErpSearchResult): string {
  return item.branch_name ? `${item.name} (${item.branch_name})` : item.name
}

interface ApiConfigSummary {
  platform: Platform
  last_test_result: string | null
}

const PLATFORM_SHORT = API_PLATFORM_SHORT
const PLATFORMS = API_CONFIG_PLATFORMS

export default function ClientsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [saving, setSaving] = useState(false)
  // ERP 거래처 연결 옵션
  const [erpLinkMode, setErpLinkMode] = useState<ErpLinkMode>('select')
  const [erpClients, setErpClients] = useState<ErpSearchResult[]>([])
  const [erpClientsLoading, setErpClientsLoading] = useState(false)
  const [selectedErpClient, setSelectedErpClient] = useState<ErpSearchResult | null>(null)
  const [erpCreateData, setErpCreateData] = useState({
    business_number: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
  })
  const erpClientsLoadedRef = useRef(false)
  // 알림 설정
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false)
  const [notifyTarget, setNotifyTarget] = useState<any>(null)
  const [notifyPhones, setNotifyPhones] = useState<string[]>([''])
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [notifySaving, setNotifySaving] = useState(false)
  const [erpClientId, setErpClientId] = useState('')
  // API 설정
  const [apiConfigTarget, setApiConfigTarget] = useState<{ id: number; name: string } | null>(null)
  const [apiConfigSummaries, setApiConfigSummaries] = useState<Record<number, ApiConfigSummary[]>>({})

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/clients')
      const data = await res.json()
      setClients(Array.isArray(data) ? data : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const fetchApiConfigSummaries = useCallback(async (clientIds: number[]) => {
    const summaries: Record<number, ApiConfigSummary[]> = {}
    await Promise.all(
      clientIds.map(async (id) => {
        try {
          const res = await fetch(`/api/admin/clients/${id}/api-configs`)
          if (!res.ok) return
          const data = await res.json()
          const items = Array.isArray(data) ? data : (data.data || [])
          summaries[id] = items.map((item: any) => ({
            platform: item.platform,
            last_test_result: item.last_test_result,
          }))
        } catch {
          // silently ignore
        }
      })
    )
    setApiConfigSummaries(prev => ({ ...prev, ...summaries }))
  }, [])

  useEffect(() => { fetchClients() }, [])

  useEffect(() => {
    if (clients.length > 0) {
      fetchApiConfigSummaries(clients.map((c: any) => c.id))
    }
  }, [clients, fetchApiConfigSummaries])

  // glitzy-web 거래처 전체 목록 로드 (1회)
  const loadErpClients = useCallback(async () => {
    if (erpClientsLoadedRef.current) return
    setErpClientsLoading(true)
    try {
      const all: ErpSearchResult[] = []
      let page = 1
      while (true) {
        const res = await fetch(`/api/admin/erp-clients?page=${page}&limit=100`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        const items = json?.data?.data || json?.data || []
        if (Array.isArray(items)) all.push(...items)
        const pagination = json?.data?.pagination
        if (!pagination || page >= pagination.totalPages) break
        page++
      }
      setErpClients(all)
      erpClientsLoadedRef.current = true
    } catch {
      toast.error('glitzy-web 거래처 목록을 불러올 수 없습니다.')
    } finally {
      setErpClientsLoading(false)
    }
  }, [])

  const resetErpForm = () => {
    setErpLinkMode('select')
    setSelectedErpClient(null)
    setErpCreateData({ business_number: '', contact_name: '', contact_phone: '', contact_email: '' })
  }

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast.error('클라이언트명과 슬러그를 입력해주세요.')
      return
    }

    if (erpLinkMode === 'select' && !selectedErpClient) {
      toast.error('거래처를 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
      }

      if (erpLinkMode === 'select' && selectedErpClient) {
        payload.erp_client_id = selectedErpClient.id
      } else if (erpLinkMode === 'create') {
        payload.create_erp_client = true
        payload.erp_client_data = {
          ...(erpCreateData.business_number ? { business_number: erpCreateData.business_number } : {}),
          ...(erpCreateData.contact_name ? { contact_name: erpCreateData.contact_name } : {}),
          ...(erpCreateData.contact_phone ? { contact_phone: erpCreateData.contact_phone } : {}),
          ...(erpCreateData.contact_email ? { contact_email: erpCreateData.contact_email } : {}),
        }
      }

      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setForm({ name: '', slug: '' })
      resetErpForm()
      setDialogOpen(false)
      toast.success('클라이언트가 등록되었습니다.')
      fetchClients()
    } catch (e: any) {
      toast.error(e.message || '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggleClientActive = async (id: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(currentActive ? '비활성화되었습니다.' : '활성화되었습니다.')
      fetchClients()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  const openNotifyDialog = (client: any) => {
    setNotifyTarget(client)
    // notify_phones 우선, fallback: notify_phone
    const phones: string[] =
      (client.notify_phones && client.notify_phones.length > 0)
        ? [...client.notify_phones]
        : (client.notify_phone ? [client.notify_phone] : [''])
    if (phones.length === 0) phones.push('')
    setNotifyPhones(phones)
    setNotifyEnabled(client.notify_enabled || false)
    setErpClientId(client.erp_client_id != null ? String(client.erp_client_id) : '')
    setNotifyDialogOpen(true)
  }

  const updatePhone = (index: number, value: string) => {
    setNotifyPhones(prev => prev.map((p, i) => i === index ? value : p))
  }

  const addPhone = () => {
    if (notifyPhones.length < 3) {
      setNotifyPhones(prev => [...prev, ''])
    }
  }

  const removePhone = (index: number) => {
    setNotifyPhones(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? [''] : next
    })
  }

  const handleNotifySave = async () => {
    if (!notifyTarget) return
    const filtered = notifyPhones.filter(p => p && p.trim())
    if (notifyEnabled && filtered.length === 0) {
      toast.error('알림을 활성화하려면 연락처를 1개 이상 입력해주세요.')
      return
    }
    setNotifySaving(true)
    try {
      const res = await fetch(`/api/admin/clients/${notifyTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notify_phones: filtered,
          notify_enabled: notifyEnabled,
          erp_client_id: erpClientId || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      toast.success('알림 설정이 저장되었습니다.')
      setNotifyDialogOpen(false)
      fetchClients()
    } catch (e: any) {
      toast.error(e.message || '알림 설정 저장 실패')
    } finally {
      setNotifySaving(false)
    }
  }

  // 테이블에 표시할 알림 번호 목록
  const getNotifyDisplay = (client: any) => {
    const phones: string[] =
      (client.notify_phones && client.notify_phones.length > 0)
        ? client.notify_phones
        : (client.notify_phone ? [client.notify_phone] : [])
    return phones
  }

  const getApiStatusColor = (clientId: number, platform: Platform): string => {
    const summaries = apiConfigSummaries[clientId]
    if (!summaries) return 'bg-muted-foreground/30'
    const item = summaries.find(s => s.platform === platform)
    if (!item) return 'bg-muted-foreground/30'
    if (item.last_test_result === 'success') return 'bg-emerald-500'
    if (item.last_test_result === 'failed') return 'bg-red-500'
    return 'bg-muted-foreground/30'
  }

  const handleApiConfigUpdated = () => {
    if (apiConfigTarget) {
      fetchApiConfigSummaries([apiConfigTarget.id])
    }
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <PageHeader icon={Building2} title="클라이언트 관리" description="클라이언트 고객사 등록 및 관리" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 클라이언트 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">클라이언트명 *</Label>
              <Input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 미래성형외과"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">슬러그 (영문소문자) *</Label>
              <Input
                type="text"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="예: mirae"
              />
              <p className="text-xs text-muted-foreground">URL에 사용됩니다. 영문 소문자, 숫자, 하이픈만 허용</p>
            </div>
            {/* glitzy-web 거래처 연결 */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">glitzy-web 거래처 연결</Label>
              <div className="flex gap-1">
                {([
                  { value: 'select' as ErpLinkMode, label: '거래처 선택' },
                  { value: 'create' as ErpLinkMode, label: '새로 생성' },
                  { value: 'later' as ErpLinkMode, label: '나중에 연결' },
                ] as const).map(opt => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={erpLinkMode === opt.value ? 'default' : 'outline'}
                    size="sm"
                    className={erpLinkMode === opt.value ? 'bg-brand-600 hover:bg-brand-700' : ''}
                    onClick={() => {
                      setErpLinkMode(opt.value)
                      setSelectedErpClient(null)
                      if (opt.value === 'select') loadErpClients()
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {/* 거래처 드롭다운 목록 */}
              {erpLinkMode === 'select' && (
                <div className="space-y-2 border border-border rounded-lg p-3">
                  {selectedErpClient ? (
                    <div className="flex items-center gap-2 bg-brand-600/10 text-brand-600 rounded-md px-3 py-2 text-sm">
                      <Link2 size={14} />
                      <span className="font-medium">{erpDisplayName(selectedErpClient)}</span>
                      <button type="button" onClick={() => setSelectedErpClient(null)} className="ml-auto hover:text-red-400">
                        <X size={14} />
                      </button>
                    </div>
                  ) : erpClientsLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-3">거래처 목록 불러오는 중...</p>
                  ) : erpClients.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">등록된 거래처가 없습니다.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">{erpClients.length}개 거래처</p>
                      <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                        {erpClients
                          .filter(item => {
                            // 이미 Agatha에 연결된 거래처는 비활성 표시
                            const alreadyLinked = clients.some((c: any) => c.erp_client_id === item.id)
                            return !alreadyLinked
                          })
                          .map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedErpClient(item)
                              const displayName = erpDisplayName(item)
                              const autoSlug = displayName
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, '')
                                .trim()
                                .replace(/\s+/g, '-')
                                .slice(0, 30) || `client-${item.id.slice(0, 8)}`
                              setForm({
                                name: displayName,
                                slug: autoSlug,
                              })
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-sm text-left border-b border-border last:border-b-0"
                          >
                            <span>
                              {erpDisplayName(item)}
                              {item.business_number && (
                                <span className="text-xs text-muted-foreground ml-2">{item.business_number}</span>
                              )}
                            </span>
                          </button>
                        ))}
                        {erpClients.filter(item => clients.some((c: any) => c.erp_client_id === item.id)).length > 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
                            이미 연결된 거래처 {erpClients.filter(item => clients.some((c: any) => c.erp_client_id === item.id)).length}개는 숨김 처리됨
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 새로 생성 */}
              {erpLinkMode === 'create' && (
                <div className="space-y-2 border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">클라이언트 저장 시 glitzy-web에 거래처가 동시에 생성됩니다.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">사업자번호</Label>
                      <Input
                        type="text"
                        value={erpCreateData.business_number}
                        onChange={e => setErpCreateData(d => ({ ...d, business_number: e.target.value }))}
                        placeholder="선택 입력"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">담당자명</Label>
                      <Input
                        type="text"
                        value={erpCreateData.contact_name}
                        onChange={e => setErpCreateData(d => ({ ...d, contact_name: e.target.value }))}
                        placeholder="선택 입력"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">연락처</Label>
                      <Input
                        type="tel"
                        value={erpCreateData.contact_phone}
                        onChange={e => setErpCreateData(d => ({ ...d, contact_phone: e.target.value }))}
                        placeholder="선택 입력"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">이메일</Label>
                      <Input
                        type="email"
                        value={erpCreateData.contact_email}
                        onChange={e => setErpCreateData(d => ({ ...d, contact_email: e.target.value }))}
                        placeholder="선택 입력"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 나중에 연결 */}
              {erpLinkMode === 'later' && (
                <p className="text-xs text-muted-foreground">거래처 연결 없이 생성합니다. 견적/계산서 기능은 비활성 상태입니다.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '등록 중...' : '클라이언트 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 알림 설정 다이얼로그 */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>클라이언트 설정 - {notifyTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">glitzy-web 거래처 ID</Label>
              <Input
                type="text"
                value={erpClientId}
                onChange={e => setErpClientId(e.target.value)}
                placeholder="UUID 입력"
              />
              <p className="text-xs text-muted-foreground">견적/계산서 연동을 위한 glitzy-web 거래처 ID</p>
            </div>
            <hr className="border-border dark:border-white/5" />
            <p className="text-xs text-muted-foreground">
              새 리드가 유입되면 등록된 연락처로 알림 문자를 발송합니다. (최대 3개)
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">담당자 연락처</Label>
              {notifyPhones.map((phone, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => updatePhone(i, e.target.value)}
                    placeholder="010-1234-5678"
                  />
                  {notifyPhones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {notifyPhones.length < 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addPhone}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus size={12} /> 연락처 추가
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">알림 활성화</Label>
              <Switch
                checked={notifyEnabled}
                onCheckedChange={setNotifyEnabled}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotifyDialogOpen(false)}>취소</Button>
            <Button onClick={handleNotifySave} disabled={notifySaving} className="bg-brand-600 hover:bg-brand-700">
              {notifySaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API 설정 다이얼로그 */}
      {apiConfigTarget && (
        <ClientApiConfigDialog
          clientId={apiConfigTarget.id}
          clientName={apiConfigTarget.name}
          open={!!apiConfigTarget}
          onClose={() => setApiConfigTarget(null)}
          onUpdated={handleApiConfigUpdated}
        />
      )}

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">클라이언트 목록 ({clients.length})</h2>
          <Button onClick={() => { setDialogOpen(true); loadErpClients() }} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 클라이언트 등록
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : clients.length === 0 ? (
          <EmptyState icon={Building2} title="등록된 클라이언트이 없습니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium">ID</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">클라이언트명</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">슬러그</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">등록일</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">API 설정</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">리드 알림</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">상태</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">설정</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c: any) => {
                const phones = getNotifyDisplay(c)
                return (
                  <TableRow key={c.id} className="border-b border-border dark:border-white/5">
                    <TableCell className="text-muted-foreground text-xs">#{c.id}</TableCell>
                    <TableCell className="text-foreground font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{c.slug}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(c.created_at)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => setApiConfigTarget({ id: c.id, name: c.name })}
                        className="flex items-center gap-1.5 group cursor-pointer"
                        aria-label="API 설정"
                      >
                        {PLATFORMS.map(p => (
                          <span
                            key={p}
                            className="flex items-center gap-1"
                            title={`${PLATFORM_SHORT[p]}: ${
                              getApiStatusColor(c.id, p).includes('emerald') ? '연결됨' :
                              getApiStatusColor(c.id, p).includes('red') ? '실패' : '미설정'
                            }`}
                          >
                            <span className={`inline-block w-2 h-2 rounded-full ${getApiStatusColor(c.id, p)}`} />
                            <span className="text-[10px] text-muted-foreground">{PLATFORM_SHORT[p]}</span>
                          </span>
                        ))}
                        <Settings2 size={12} className="ml-1 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                      </button>
                    </TableCell>
                    <TableCell>
                      {c.notify_enabled && phones.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {phones.map((p: string, i: number) => (
                            <span key={i} className="flex items-center gap-1.5 text-xs text-emerald-400">
                              <Bell size={11} />
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">미설정</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={() => toggleClientActive(c.id, c.is_active)}
                      />
                    </TableCell>
                    <TableCell>
                      <button onClick={() => openNotifyDialog(c)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="알림 설정">
                        <Pencil size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
