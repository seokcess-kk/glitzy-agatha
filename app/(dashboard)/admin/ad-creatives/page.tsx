'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Plus, Image, Trash2, Pencil, Upload, X, Film, ChevronDown, Copy, QrCode, ExternalLink } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { QRCodeDialog } from '@/app/(dashboard)/utm/components/QRCodeDialog'
import { buildUtmUrl } from '@/lib/utm'

interface LandingPage {
  id: number
  name: string
  file_name: string
  client_id: number | null
}

interface AdCreative {
  id: number
  name: string
  description: string | null
  utm_content: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  platform: string | null
  client_id: number
  landing_page_id: number | null
  is_active: boolean
  file_name: string | null
  file_type: string | null
  created_at: string
  client?: { id: number; name: string } | null
  landing_page?: { id: number; name: string; file_name: string } | null
}

import { CREATIVE_PLATFORMS, PLATFORM_UTM_SOURCES, apiToCreativePlatform } from '@/lib/platform'

const PLATFORM_OPTIONS = CREATIVE_PLATFORMS.map(p => ({ value: p.value, label: p.label }))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']

function getCreativeUrl(fileName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/creatives/${fileName}`
}

export default function AdCreativesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [adCreatives, setAdCreatives] = useState<AdCreative[]>([])
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdCreative | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', utm_content: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '',
    platform: '', client_id: '', landing_page_id: '', is_active: true,
    file_name: '' as string | null, file_type: '' as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [viewerType, setViewerType] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [qrLabel, setQrLabel] = useState('')

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [acRes, lpRes, cRes] = await Promise.all([
        fetch('/api/admin/ad-creatives').then(r => r.json()),
        fetch('/api/admin/landing-pages').then(r => r.json()),
        fetch('/api/admin/clients').then(r => r.json()),
      ])
      setAdCreatives(Array.isArray(acRes) ? acRes : [])
      if (lpRes.landingPages) {
        setLandingPages(lpRes.landingPages)
      } else {
        setLandingPages(Array.isArray(lpRes) ? lpRes : [])
      }
      setClients(Array.isArray(cRes) ? cRes : [])
    } catch {
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      // 1) signed URL 발급
      const urlRes = await fetch('/api/admin/ad-creatives/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlData.error || '업로드 URL 생성 실패')

      // 2) Supabase Storage에 직접 업로드
      const uploadRes = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('파일 업로드 실패')

      setForm(f => ({ ...f, file_name: urlData.fileName, file_type: file.type }))
      // 미리보기
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setPreviewType(file.type)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '업로드 실패'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('이미지(JPG, PNG, GIF, WebP) 또는 동영상(MP4, WebM)만 업로드 가능합니다.')
      return
    }
    handleFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!uploading) setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragOver(false)
  }

  const clearFile = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setForm(f => ({ ...f, file_name: null, file_type: null }))
    setPreviewUrl(null)
    setPreviewType(null)
  }

  const handleSave = async () => {
    if (!form.name || !form.utm_content || !form.client_id) {
      toast.error('소재명, UTM Content, 클라이언트을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/ad-creatives/${editing.id}` : '/api/admin/ad-creatives'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: form.client_id && form.client_id !== 'none' ? Number(form.client_id) : null,
          landing_page_id: form.landing_page_id && form.landing_page_id !== 'none' ? Number(form.landing_page_id) : null,
          platform: form.platform && form.platform !== 'none' ? form.platform : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      resetForm()
      setDialogOpen(false)
      toast.success(editing ? '광고 소재가 수정되었습니다.' : '광고 소재가 등록되었습니다.')
      fetchData()
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setForm({
      name: '', description: '', utm_content: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '',
      platform: '', client_id: '', landing_page_id: '', is_active: true, file_name: null, file_type: null,
    })
    setEditing(null)
    setPreviewUrl(null)
    setPreviewType(null)
  }

  const openFormWith = (creative: AdCreative, nameOverride?: string, utmContentOverride?: string) => {
    const creativePlatform = creative.platform ? apiToCreativePlatform(creative.platform) : ''
    setForm({
      name: nameOverride ?? creative.name,
      description: creative.description || '',
      utm_content: utmContentOverride ?? creative.utm_content,
      utm_source: creative.utm_source || '',
      utm_medium: creative.utm_medium || '',
      utm_campaign: creative.utm_campaign || '',
      utm_term: creative.utm_term || '',
      platform: creativePlatform,
      client_id: String(creative.client_id),
      landing_page_id: creative.landing_page_id ? String(creative.landing_page_id) : '',
      is_active: creative.is_active,
      file_name: creative.file_name,
      file_type: creative.file_type,
    })
    if (creative.file_name) {
      setPreviewUrl(getCreativeUrl(creative.file_name))
      setPreviewType(creative.file_type)
    }
    setDialogOpen(true)
  }

  const handleEdit = (creative: AdCreative) => {
    setEditing(creative)
    openFormWith(creative)
  }

  const handleDuplicate = (creative: AdCreative) => {
    setEditing(null)
    openFormWith(creative, `${creative.name} (복사)`, `${creative.utm_content}_copy`)
  }

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      const res = await fetch(`/api/admin/ad-creatives/${deleteTarget}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      toast.success('삭제되었습니다.')
      fetchData()
    } catch {
      toast.error('삭제 실패')
    }
    setDeleteTarget(null)
  }

  const toggleActive = async (creative: AdCreative) => {
    try {
      const res = await fetch(`/api/admin/ad-creatives/${creative.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !creative.is_active }),
      })
      if (!res.ok) throw new Error()
      toast.success(creative.is_active ? '비활성화되었습니다.' : '활성화되었습니다.')
      fetchData()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  const filteredLandingPages = form.client_id
    ? landingPages.filter(lp => lp.client_id === Number(form.client_id) || !lp.client_id)
    : landingPages

  const getCreativeUtmUrl = (creative: AdCreative): string | null => {
    if (!creative.landing_page_id) return null
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return buildUtmUrl({
      baseUrl: `${origin}/lp?id=${creative.landing_page_id}`,
      source: creative.utm_source || undefined,
      medium: creative.utm_medium || undefined,
      campaign: creative.utm_campaign || undefined,
      content: creative.utm_content || undefined,
      term: creative.utm_term || undefined,
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('URL이 클립보드에 복사되었습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  if (user?.role !== 'superadmin') return null

  const utmSources = form.platform && form.platform !== 'none' ? PLATFORM_UTM_SOURCES[form.platform] : null

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="삭제 확인"
        description="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={confirmDelete}
      />
      <QRCodeDialog open={qrOpen} onOpenChange={setQrOpen} url={qrUrl} label={qrLabel} />
      <PageHeader icon={Image} title="광고 소재" description="광고 소재 등록 및 UTM 파라미터 관리" />

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '광고 소재 수정' : '신규 광고 소재 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 소재 파일 업로드 */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">소재 파일 (이미지/동영상)</Label>
              {previewUrl ? (
                <div className="relative inline-block">
                  {previewType?.startsWith('video/') ? (
                    <video src={previewUrl} className="h-32 rounded-lg bg-muted dark:bg-white/5" controls muted />
                  ) : (
                    <img src={previewUrl} alt="미리보기" className="h-32 rounded-lg object-contain bg-muted dark:bg-white/5" />
                  )}
                  <button
                    onClick={clearFile}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  disabled={uploading}
                  className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
                    dragOver
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-border dark:border-white/10 text-muted-foreground hover:border-brand-500/50'
                  }`}
                >
                  <Upload size={20} />
                  <span className="text-xs">{uploading ? '업로드 중...' : dragOver ? '여기에 놓으세요' : '클릭 또는 파일을 드래그하세요'}</span>
                  <span className="text-[10px] text-muted-foreground/60">JPG, PNG, GIF, WebP, MP4, WebM (50MB 이하)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">소재명 *</Label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 3월 프로모션 영상 30초"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">UTM Content *</Label>
                <Input
                  type="text"
                  value={form.utm_content}
                  onChange={e => setForm(f => ({ ...f, utm_content: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                  placeholder="예: video_30s_promo"
                />
                <p className="text-xs text-muted-foreground">UTM 링크에 사용될 값 (영문, 숫자, 언더스코어)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">클라이언트 *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v, landing_page_id: '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="클라이언트 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">광고 플랫폼</Label>
                <Select value={form.platform} onValueChange={v => {
                  const sources = PLATFORM_UTM_SOURCES[v]
                  if (sources?.length) {
                    setForm(f => ({
                      ...f,
                      platform: v,
                      utm_source: sources[0].value,
                    }))
                  } else {
                    setForm(f => ({ ...f, platform: v }))
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {PLATFORM_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* UTM 파라미터 섹션 */}
            <div className="border-t border-border dark:border-white/10 pt-4 mt-4">
              <p className="text-xs text-muted-foreground mb-3">
                UTM 파라미터 {utmSources ? '(플랫폼 기준 자동 설정)' : '(선택사항 - 직접 입력)'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">UTM Source (유입경로)</Label>
                  {utmSources ? (
                    <Select value={form.utm_source} onValueChange={v => setForm(f => ({ ...f, utm_source: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="매체 유형 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {utmSources.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={form.utm_source}
                      onChange={e => setForm(f => ({ ...f, utm_source: e.target.value }))}
                      placeholder="예: google_search, meta_feed"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">UTM Medium (과금 방식)</Label>
                  <Input
                    type="text"
                    value={form.utm_medium}
                    onChange={e => setForm(f => ({ ...f, utm_medium: e.target.value }))}
                    placeholder="예: cpc, cpm, cpv"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">UTM Campaign</Label>
                  <Input
                    type="text"
                    value={form.utm_campaign}
                    onChange={e => setForm(f => ({ ...f, utm_campaign: e.target.value }))}
                    placeholder="예: march_promo_2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">UTM Term</Label>
                  <Input
                    type="text"
                    value={form.utm_term}
                    onChange={e => setForm(f => ({ ...f, utm_term: e.target.value }))}
                    placeholder="예: 피부관리, 안티에이징"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">연결 랜딩 페이지</Label>
              <Select
                value={form.landing_page_id}
                onValueChange={v => setForm(f => ({ ...f, landing_page_id: v }))}
                disabled={!form.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.client_id ? "랜딩 페이지 선택" : "클라이언트을 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  {filteredLandingPages.map(lp => (
                    <SelectItem key={lp.id} value={String(lp.id)}>
                      {lp.name} ({lp.file_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">설명 (메모)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="소재에 대한 설명"
                rows={2}
              />
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
            <Button onClick={handleSave} disabled={saving || uploading} className="bg-brand-600 hover:bg-brand-700">
              {saving ? '저장 중...' : (editing ? '수정' : '등록')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground">광고 소재 목록 ({adCreatives.length})</h2>
            <p className="text-xs text-muted-foreground mt-1">소재별 UTM Content 값과 랜딩 페이지 연결을 관리합니다.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Plus size={14} /> 소재 등록
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : adCreatives.length === 0 ? (
          <EmptyState icon={Image} title="등록된 광고 소재가 없습니다." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium w-[76px]">소재</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">소재명 / UTM Content</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">플랫폼 / 클라이언트</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">상태</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium w-[120px]">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adCreatives.map((creative) => {
                const isExpanded = expandedId === creative.id
                const utmUrl = getCreativeUtmUrl(creative)
                return (
                  <React.Fragment key={creative.id}>
                    {/* 1단: 축소 행 */}
                    <TableRow
                      className="border-b border-border dark:border-white/5 cursor-pointer hover:bg-muted/30 dark:hover:bg-muted/30 dark:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : creative.id)}
                    >
                      <TableCell>
                        <div
                          className={`w-[60px] h-[60px] ${creative.file_name ? 'cursor-pointer' : ''}`}
                          onClick={(e) => {
                            if (creative.file_name) {
                              e.stopPropagation()
                              setViewerSrc(getCreativeUrl(creative.file_name))
                              setViewerType(creative.file_type)
                              setViewerOpen(true)
                            }
                          }}
                        >
                          {creative.file_name ? (
                            creative.file_type?.startsWith('video/') ? (
                              <div className="w-[60px] h-[60px] rounded-lg bg-muted dark:bg-white/5 overflow-hidden relative">
                                <video src={getCreativeUrl(creative.file_name)} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors">
                                  <Film size={16} className="text-white/80" />
                                </div>
                              </div>
                            ) : (
                              <img src={getCreativeUrl(creative.file_name)} alt={creative.name} className="w-[60px] h-[60px] rounded-lg object-cover bg-muted dark:bg-white/5 hover:opacity-80 transition-opacity" />
                            )
                          ) : (
                            <div className="w-[60px] h-[60px] rounded-lg bg-muted dark:bg-white/5 flex items-center justify-center text-muted-foreground/60">
                              <Image size={20} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground font-medium text-sm">{creative.name}</div>
                        <code className="text-[11px] text-brand-400 bg-muted dark:bg-white/5 px-1.5 py-0.5 rounded mt-1 inline-block">
                          {creative.utm_content}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-muted-foreground text-xs">
                          {PLATFORM_OPTIONS.find(p => p.value === creative.platform || p.value === apiToCreativePlatform(creative.platform || ''))?.label || creative.platform || '-'}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">{creative.client?.name || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div onClick={e => e.stopPropagation()}>
                          <Switch
                            checked={creative.is_active}
                            onCheckedChange={() => toggleActive(creative)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(creative) }}
                            className="text-muted-foreground hover:text-brand-400 transition-colors"
                            aria-label="복사"
                            title="소재 복사"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(creative) }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="수정"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(creative.id) }}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                            aria-label="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronDown
                            size={14}
                            className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* 2단: 펼침 패널 */}
                    {isExpanded && (
                      <TableRow className="border-b border-border dark:border-white/5 bg-muted/30 dark:bg-white/[0.02]">
                        <TableCell colSpan={5} className="p-0">
                          <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 좌측: UTM 파라미터 */}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground font-medium mb-2">UTM 파라미터</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Source: </span>
                                  <span className="text-foreground/80">{creative.utm_source || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Medium: </span>
                                  <span className="text-foreground/80">{creative.utm_medium || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Campaign: </span>
                                  <span className="text-foreground/80">{creative.utm_campaign || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Term: </span>
                                  <span className="text-foreground/80">{creative.utm_term || '-'}</span>
                                </div>
                              </div>
                              <div className="text-xs mt-2">
                                <span className="text-muted-foreground">랜딩페이지: </span>
                                {creative.landing_page ? (
                                  <span className="text-foreground/80">{creative.landing_page.name}</span>
                                ) : (
                                  <span className="text-muted-foreground/60">미연결</span>
                                )}
                              </div>
                            </div>

                            {/* 우측: UTM URL + 액션 */}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground font-medium mb-2">UTM URL</p>
                              {utmUrl ? (
                                <>
                                  <div className="bg-card rounded-lg p-2.5">
                                    <p className="text-[11px] text-foreground/80 break-all font-mono leading-relaxed">{utmUrl}</p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(utmUrl) }}
                                    >
                                      <Copy size={12} className="mr-1" /> 복사
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setQrUrl(utmUrl)
                                        setQrLabel(creative.utm_content)
                                        setQrOpen(true)
                                      }}
                                    >
                                      <QrCode size={12} className="mr-1" /> QR
                                    </Button>
                                    <a
                                      href={utmUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                                        <ExternalLink size={12} className="mr-1" /> 열기
                                      </Button>
                                    </a>
                                  </div>
                                </>
                              ) : (
                                <div className="bg-card rounded-lg p-3 text-center">
                                  <p className="text-xs text-muted-foreground/60">랜딩 페이지 미연결</p>
                                  <p className="text-[10px] text-muted-foreground/60 mt-1">소재에 랜딩 페이지를 연결하면 UTM URL이 자동 생성됩니다.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
