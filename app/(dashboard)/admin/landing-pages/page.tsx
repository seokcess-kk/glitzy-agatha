'use client'
import { useState, useEffect } from 'react'
import { Plus, FileText, Copy, ExternalLink, Trash2, Pencil, Upload, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { ConfirmDialog, EmptyState, PageHeader } from '@/components/common'

interface LandingPage {
  id: number
  name: string
  file_name: string
  original_file_name: string | null
  client_id: number | null
  description: string | null
  is_active: boolean
  created_at: string
  client?: { id: number; name: string } | null
}

export default function LandingPagesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<number, { lead_count: number; booking_count: number; paying_contacts: number; revenue: number; booking_rate: number; conversion_rate: number }>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LandingPage | null>(null)
  const [form, setForm] = useState({ name: '', file_name: '', client_id: '', description: '', gtm_id: '', redirect_url: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [fileMode, setFileMode] = useState<'select' | 'upload'>('select')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [lpRes, cRes, statsRes] = await Promise.all([
        fetch('/api/admin/landing-pages?includeFiles=true').then(r => r.json()),
        fetch('/api/admin/clients').then(r => r.json()),
        fetch('/api/admin/landing-pages/stats').then(r => r.json()).catch(() => []),
      ])
      if (lpRes.landingPages) {
        setLandingPages(lpRes.landingPages)
        setAvailableFiles(lpRes.availableFiles || [])
      } else {
        setLandingPages(Array.isArray(lpRes) ? lpRes : [])
      }
      setClients(Array.isArray(cRes) ? cRes : [])
      // 성과 통계를 landing_page_id 기준 맵으로 변환
      if (Array.isArray(statsRes)) {
        const map: Record<number, any> = {}
        statsRes.forEach((s: any) => { map[s.landing_page_id] = s })
        setStats(map)
      }
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    const needsUpload = fileMode === 'upload'
    if (!form.name || (!needsUpload && !form.file_name) || (needsUpload && !uploadFile)) {
      toast.error(needsUpload ? '이름과 HTML 파일을 첨부해주세요.' : '이름과 파일을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      let fileName = form.file_name
      let originalFileName: string | null = null

      // 파일 업로드 처리
      if (needsUpload && uploadFile) {
        setUploading(true)
        originalFileName = uploadFile.name
        const formData = new FormData()
        formData.append('file', uploadFile)
        if (editing) {
          formData.append('overwrite', editing.file_name)
        }
        const uploadRes = await fetch('/api/admin/landing-pages/upload', {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          let errMsg = '파일 업로드 실패'
          try { const err = await uploadRes.json(); errMsg = err.error || errMsg } catch {}
          throw new Error(errMsg)
        }
        const uploadData = await uploadRes.json()
        fileName = uploadData.fileName
        originalFileName = uploadData.originalFileName || originalFileName
        setUploading(false)
      }

      const url = editing ? `/api/admin/landing-pages/${editing.id}` : '/api/admin/landing-pages'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          file_name: fileName,
          ...(originalFileName && { original_file_name: originalFileName }),
          client_id: form.client_id && form.client_id !== 'none' ? Number(form.client_id) : null,
        }),
      })
      if (!res.ok) {
        let errMsg = '저장 실패'
        try { const err = await res.json(); errMsg = err.error || errMsg } catch {}
        throw new Error(errMsg)
      }
      setForm({ name: '', file_name: '', client_id: '', description: '', gtm_id: '', redirect_url: '', is_active: true })
      setUploadFile(null)
      setFileMode('select')
      setEditing(null)
      setDialogOpen(false)
      toast.success(editing ? '랜딩 페이지가 수정되었습니다.' : '랜딩 페이지가 등록되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handleEdit = (lp: LandingPage) => {
    setEditing(lp)
    setFileMode('select')
    setUploadFile(null)
    setForm({
      name: lp.name,
      file_name: lp.file_name,
      client_id: lp.client_id ? String(lp.client_id) : '',
      description: lp.description || '',
      gtm_id: (lp as any).gtm_id || '',
      redirect_url: (lp as any).redirect_url || '',
      is_active: lp.is_active,
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      const res = await fetch(`/api/admin/landing-pages/${deleteTarget}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      toast.success('삭제되었습니다.')
      fetchData()
    } catch {
      toast.error('삭제 실패')
    }
    setDeleteTarget(null)
  }

  const toggleActive = async (id: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/landing-pages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(currentActive ? '비활성화되었습니다.' : '활성화되었습니다.')
      fetchData()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  const copyUrl = (id: number) => {
    const url = `${window.location.origin}/lp?id=${id}`
    navigator.clipboard.writeText(url)
    toast.success('URL이 복사되었습니다.')
  }

  if (user?.role !== 'superadmin') return null

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="삭제 확인"
        description="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={confirmDelete}
      />
      <PageHeader icon={FileText} title="랜딩 페이지" description="랜딩 페이지 등록 및 클라이언트 배정" />

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setEditing(null)
          setForm({ name: '', file_name: '', client_id: '', description: '', gtm_id: '', redirect_url: '', is_active: true })
          setUploadFile(null)
          setFileMode('select')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '랜딩 페이지 수정' : '신규 랜딩 페이지 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">이름 *</Label>
              <Input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 세레아 3월 프로모션"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">HTML 파일 *</Label>
              <div className="flex gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => { setFileMode('select'); setUploadFile(null) }}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${fileMode === 'select' ? 'bg-brand-600 text-white' : 'bg-muted dark:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                >
                  기존 파일 선택
                </button>
                <button
                  type="button"
                  onClick={() => { setFileMode('upload'); setForm(f => ({ ...f, file_name: '' })) }}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${fileMode === 'upload' ? 'bg-brand-600 text-white' : 'bg-muted dark:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                >
                  새 파일 업로드
                </button>
              </div>
              {fileMode === 'select' ? (
                <>
                  <Select value={form.file_name} onValueChange={v => setForm(f => ({ ...f, file_name: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="파일 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFiles.map((file) => (
                        <SelectItem key={file} value={file}>{file}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">public/landing/ 폴더에 있는 HTML 파일</p>
                </>
              ) : (
                <>
                  {uploadFile ? (
                    <div className="flex items-center gap-2 bg-muted dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-3 py-2.5">
                      <FileText size={16} className="text-brand-400 shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">{uploadFile.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(uploadFile.size / 1024).toFixed(1)}KB</span>
                      <button
                        type="button"
                        onClick={() => setUploadFile(null)}
                        className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border dark:border-white/10 hover:border-brand-500/50 rounded-lg py-6 cursor-pointer transition-colors"
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-brand-500/50') }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-500/50') }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-brand-500/50')
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.name.match(/\.html?$/i)) {
                          setUploadFile(file)
                        } else {
                          toast.error('HTML 파일만 업로드할 수 있습니다.')
                        }
                      }}
                    >
                      <Upload size={24} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">HTML 파일을 선택하거나 여기에 드래그하세요</span>
                      <span className="text-xs text-muted-foreground/60">최대 5MB, .html</span>
                      <input
                        type="file"
                        accept=".html"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setUploadFile(file)
                        }}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">배정 클라이언트</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="선택 (미배정 가능)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미배정</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">설명 (메모)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="관리자 메모"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">GTM ID</Label>
              <Input
                value={form.gtm_id}
                onChange={e => setForm(f => ({ ...f, gtm_id: e.target.value }))}
                placeholder="GTM-XXXXXXX (미입력 시 기본값 사용)"
              />
              <p className="text-[10px] text-muted-foreground/60">랜딩페이지 서빙 시 자동 삽입됩니다. 비워두면 기본 GTM ID가 적용됩니다.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">제출 후 이동 URL</Label>
              <Input
                value={form.redirect_url}
                onChange={e => setForm(f => ({ ...f, redirect_url: e.target.value }))}
                placeholder="https://your-client.com (미입력 시 이동 없음)"
              />
              <p className="text-[10px] text-muted-foreground/60">리드 폼 제출 성공 후 자동 이동할 URL. 비워두면 완료 메시지만 표시됩니다.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">활성화</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? (uploading ? '업로드 중...' : '저장 중...') : (editing ? '수정' : '등록')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">랜딩 페이지 목록 ({landingPages.length})</h2>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 랜딩 페이지 등록
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : landingPages.length === 0 ? (
          <EmptyState icon={FileText} title="등록된 랜딩 페이지가 없습니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium">ID</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">이름</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">파일명</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">배정 클라이언트</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">URL</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">리드</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">예약</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">결제</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">매출</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">상태</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {landingPages.map((lp) => (
                <TableRow key={lp.id} className="border-b border-border dark:border-white/5">
                  <TableCell className="text-muted-foreground text-xs">#{lp.id}</TableCell>
                  <TableCell className="text-foreground font-medium">{lp.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{lp.original_file_name || lp.file_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{lp.client?.name || '미배정'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-brand-400 bg-muted dark:bg-white/5 px-2 py-1 rounded">/lp?id={lp.id}</code>
                      <button onClick={() => copyUrl(lp.id)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="URL 복사">
                        <Copy size={12} />
                      </button>
                      <a href={`/lp?id=${lp.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="새 탭에서 열기">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.lead_count ? (
                      <Link
                        href={`/customers?landing_page_id=${lp.id}`}
                        className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                      >
                        {stats[lp.id].lead_count}건
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.booking_count ? (
                      <span className="text-blue-400 text-sm">{stats[lp.id].booking_count}<span className="text-muted-foreground/60 text-xs ml-1">({stats[lp.id].booking_rate}%)</span></span>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.paying_contacts ? (
                      <span className="text-emerald-400 text-sm">{stats[lp.id].paying_contacts}<span className="text-muted-foreground/60 text-xs ml-1">({stats[lp.id].conversion_rate}%)</span></span>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stats[lp.id]?.revenue ? (
                      <span className="text-emerald-400 font-semibold text-sm">₩{stats[lp.id].revenue.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={lp.is_active}
                      onCheckedChange={() => toggleActive(lp.id, lp.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(lp)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="수정">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(lp.id)} className="text-muted-foreground hover:text-red-400 transition-colors" aria-label="삭제">
                        <Trash2 size={14} />
                      </button>
                    </div>
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
