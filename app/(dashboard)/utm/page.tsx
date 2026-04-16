'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Trash2, ExternalLink, ChevronDown, Link2, QrCode, RefreshCw, Database, FileText, Image, ArrowLeft, Search } from 'lucide-react'
import { toast } from 'sonner'
import { toUtcDate } from '@/lib/date'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TemplateSelector, UtmTemplate, TemplateFormData } from './components/TemplateSelector'
import { QRCodeDialog } from './components/QRCodeDialog'
import { ConfirmDialog, PageHeader } from '@/components/common'

interface LandingPage {
  id: number
  name: string
  file_name: string
  client_id: number | null
  is_active: boolean
  client?: { id: number; name: string } | null
}

interface AdCreative {
  id: number
  name: string
  utm_content: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  platform: string | null
  client_id: number
  landing_page_id: number | null
  is_active: boolean
  client?: { id: number; name: string } | null
  landing_page?: { id: number; name: string } | null
}

interface PlatformPreset {
  source: string
  medium: string
  label: string
  group: string
}

const PLATFORM_PRESETS: Record<string, PlatformPreset> = {
  // 광고 매체 — source: 플랫폼+매체유형, medium: 과금 방식
  meta_feed:         { source: 'meta_feed',         medium: 'cpc',     label: 'Meta Feed',           group: '광고 매체' },
  meta_reels:        { source: 'meta_reels',        medium: 'cpc',     label: 'Meta Reels',          group: '광고 매체' },
  google_search:     { source: 'google_search',     medium: 'cpc',     label: 'Google 검색',          group: '광고 매체' },
  google_gdn:        { source: 'google_gdn',        medium: 'cpc',     label: 'Google GDN',          group: '광고 매체' },
  google_pmax:       { source: 'google_pmax',       medium: 'cpc',     label: 'Google PMax',         group: '광고 매체' },
  google_demand_gen: { source: 'google_demand_gen', medium: 'cpc',     label: 'Google Demand Gen',   group: '광고 매체' },
  google_youtube:    { source: 'google_youtube',    medium: 'cpv',     label: 'Google YouTube',      group: '광고 매체' },
  naver_sa:          { source: 'naver_sa',          medium: 'cpc',     label: '네이버 SA',             group: '광고 매체' },
  naver_gfa:         { source: 'naver_gfa',         medium: 'cpc',     label: '네이버 GFA',            group: '광고 매체' },
  kakao_moment:      { source: 'kakao_moment',      medium: 'cpc',     label: '카카오 모먼트',          group: '광고 매체' },
  kakao_keyword:     { source: 'kakao_keyword',     medium: 'cpc',     label: '카카오 키워드',          group: '광고 매체' },
  tiktok_feed:       { source: 'tiktok_feed',       medium: 'cpc',     label: 'TikTok In-Feed',      group: '광고 매체' },
  dable_native:      { source: 'dable_native',      medium: 'cpc',     label: 'Dable Native',        group: '광고 매체' },
  // 콘텐츠 매체
  youtube_video:     { source: 'youtube_video',     medium: 'video',   label: '유튜브 영상',           group: '콘텐츠 매체' },
  youtube_shorts:    { source: 'youtube_shorts',    medium: 'short',   label: '유튜브 Shorts',        group: '콘텐츠 매체' },
  instagram_feed:    { source: 'instagram_feed',    medium: 'social',  label: '인스타그램 피드',        group: '콘텐츠 매체' },
  instagram_reels:   { source: 'instagram_reels',   medium: 'short',   label: '인스타그램 릴스',        group: '콘텐츠 매체' },
  tiktok_content:    { source: 'tiktok_content',    medium: 'short',   label: '틱톡 콘텐츠',           group: '콘텐츠 매체' },
  naver_blog:        { source: 'naver_blog',        medium: 'blog',    label: '네이버 블로그',          group: '콘텐츠 매체' },
  // 기타
  custom:            { source: '',                  medium: '',        label: '직접 입력',             group: '기타' },
}

const GROUPS = ['광고 매체', '콘텐츠 매체', '기타']

interface UtmLink {
  id: number
  original_url: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  label: string | null
  created_at: string
}

// 날짜 포맷 옵션 상수
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

export default function UtmPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  const [view, setView] = useState<'list' | 'generator'>('list')
  const [links, setLinks] = useState<UtmLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [historySearch, setHistorySearch] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const fetchLinks = useCallback(async () => {
    setLinksLoading(true)
    try {
      const res = await fetch('/api/utm/links?limit=100')
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
      }
    } catch {
      // ignore
    } finally {
      setLinksLoading(false)
    }
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const filteredLinks = useMemo(() => {
    if (!historySearch) return links
    const s = historySearch.toLowerCase()
    return links.filter(item =>
      item.label?.toLowerCase().includes(s) ||
      item.utm_source?.toLowerCase().includes(s) ||
      item.utm_campaign?.toLowerCase().includes(s) ||
      item.utm_content?.toLowerCase().includes(s) ||
      item.original_url?.toLowerCase().includes(s)
    )
  }, [links, historySearch])

  const handleCopy = (link: UtmLink) => {
    const url = new URL(link.original_url)
    if (link.utm_source) url.searchParams.set('utm_source', link.utm_source)
    if (link.utm_medium) url.searchParams.set('utm_medium', link.utm_medium)
    if (link.utm_campaign) url.searchParams.set('utm_campaign', link.utm_campaign)
    if (link.utm_content) url.searchParams.set('utm_content', link.utm_content)
    if (link.utm_term) url.searchParams.set('utm_term', link.utm_term)
    navigator.clipboard.writeText(url.toString())
    setCopiedId(link.id)
    toast.success('URL이 복사되었습니다.')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    const res = await fetch(`/api/utm/links/${deleteTarget}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('삭제되었습니다.')
      setLinks(prev => prev.filter(l => l.id !== deleteTarget))
    } else {
      toast.error('삭제 실패')
    }
    setDeleteTarget(null)
  }

  if (user?.role !== 'superadmin') return null

  if (view === 'generator') {
    return <UtmGenerator onBack={() => { setView('list'); fetchLinks() }} />
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="삭제 확인"
        description="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={confirmDelete}
      />
      <PageHeader
        icon={Link2}
        title="UTM 생성"
        description="생성된 UTM 링크 목록 및 관리"
        actions={
          <Button onClick={() => setView('generator')} className="bg-brand-600 hover:bg-brand-700">
            <Link2 size={14} /> UTM 생성
          </Button>
        }
      />

      {/* 검색 */}
      <Card variant="glass" className="flex items-center px-3 py-2 mb-4">
        <Search size={14} className="text-muted-foreground mr-2" />
        <input
          type="text"
          value={historySearch}
          onChange={e => setHistorySearch(e.target.value)}
          placeholder="URL, 캠페인, 소스, 콘텐츠 검색..."
          className="bg-transparent border-0 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none w-full"
        />
      </Card>

      {/* 목록 */}
      <div className="space-y-2">
        {linksLoading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/50 dark:bg-white/[0.04] animate-pulse" />
          ))
        ) : filteredLinks.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <Link2 size={32} className="text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {historySearch ? '검색 결과가 없습니다.' : '생성된 UTM 링크가 없습니다.'}
            </p>
            {!historySearch && (
              <Button onClick={() => setView('generator')} className="mt-4 bg-brand-600 hover:bg-brand-700" size="sm">
                <Link2 size={14} /> 첫 번째 UTM 생성하기
              </Button>
            )}
          </Card>
        ) : (
          filteredLinks.map(link => (
            <div
              key={link.id}
              className="px-4 py-3 rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-md"
            >
              {/* 1행: 라벨 + URL + 시간 + 액션 */}
              <div className="flex items-center gap-3 mb-1.5">
                {link.label && (
                  <p className="text-sm font-semibold text-foreground truncate">{link.label}</p>
                )}
                <code className="text-xs text-brand-400 truncate flex-1">{link.original_url}</code>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {toUtcDate(link.created_at).toLocaleString('ko', DATE_FORMAT_OPTIONS)}
                </span>
                <button
                  onClick={() => handleCopy(link)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="URL 복사"
                >
                  {copiedId === link.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                <a
                  href={link.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="새 탭에서 열기"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => handleDelete(link.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {/* 2행: UTM 태그 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {link.utm_source && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {link.utm_source}
                  </span>
                )}
                {link.utm_medium && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {link.utm_medium}
                  </span>
                )}
                {link.utm_campaign && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {link.utm_campaign}
                  </span>
                )}
                {link.utm_content && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {link.utm_content}
                  </span>
                )}
                {link.utm_term && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                    {link.utm_term}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function UtmGenerator({ onBack }: { onBack: () => void }) {
  // Form state
  const [baseUrl, setBaseUrl] = useState('')
  const [platform, setPlatform] = useState('meta')
  const [source, setSource] = useState('meta')
  const [medium, setMedium] = useState('cpc')
  const [campaign, setCampaign] = useState('')
  const [adGroup, setAdGroup] = useState('')
  const [content, setContent] = useState('')
  const [term, setTerm] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [historyLabel, setHistoryLabel] = useState('')

  // Template state
  const [templates, setTemplates] = useState<UtmTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [templatesLoading, setTemplatesLoading] = useState(true)

  // Links history state
  const [links, setLinks] = useState<UtmLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(true)
  const [historySearch, setHistorySearch] = useState('')

  // QR Code dialog
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  // Landing pages state
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [landingPagesLoading, setLandingPagesLoading] = useState(true)
  const [selectedLandingPage, setSelectedLandingPage] = useState<string>('')

  // Ad creatives state
  const [adCreatives, setAdCreatives] = useState<AdCreative[]>([])
  const [adCreativesLoading, setAdCreativesLoading] = useState(true)
  const [selectedCreative, setSelectedCreative] = useState<string>('')
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)

  // 필터링된 링크 목록 (메모이제이션)
  const filteredLinks = useMemo(() => {
    if (!historySearch) return links
    const search = historySearch.toLowerCase()
    return links.filter(item =>
      item.label?.toLowerCase().includes(search) ||
      item.utm_source?.toLowerCase().includes(search) ||
      item.utm_campaign?.toLowerCase().includes(search) ||
      item.utm_content?.toLowerCase().includes(search) ||
      item.utm_medium?.toLowerCase().includes(search)
    )
  }, [links, historySearch])

  // Fetch landing pages
  const fetchLandingPages = useCallback(async () => {
    setLandingPagesLoading(true)
    try {
      const res = await fetch('/api/admin/landing-pages')
      if (res.ok) {
        const data = await res.json()
        // 활성화된 랜딩 페이지만 필터링
        const activePages = (Array.isArray(data) ? data : []).filter((lp: LandingPage) => lp.is_active)
        setLandingPages(activePages)
      }
    } catch (err) {
      console.error('랜딩 페이지 로드 실패:', err)
    } finally {
      setLandingPagesLoading(false)
    }
  }, [])

  // Fetch ad creatives
  const fetchAdCreatives = useCallback(async () => {
    setAdCreativesLoading(true)
    try {
      const res = await fetch('/api/admin/ad-creatives?active=true')
      if (res.ok) {
        const data = await res.json()
        setAdCreatives(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('광고 소재 로드 실패:', err)
    } finally {
      setAdCreativesLoading(false)
    }
  }, [])

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/utm/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])

        // 기본 템플릿 자동 적용
        const defaultTemplate = data.templates?.find((t: UtmTemplate) => t.is_default)
        if (defaultTemplate && !selectedTemplateId) {
          applyTemplate(defaultTemplate)
        }
      }
    } catch (err) {
      console.error('템플릿 로드 실패:', err)
    } finally {
      setTemplatesLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch links history
  const fetchLinks = useCallback(async () => {
    setLinksLoading(true)
    try {
      const res = await fetch('/api/utm/links?limit=50')
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
      }
    } catch (err) {
      console.error('링크 히스토리 로드 실패:', err)
    } finally {
      setLinksLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
    fetchLinks()
    fetchLandingPages()
    fetchAdCreatives()
  }, [fetchTemplates, fetchLinks, fetchLandingPages, fetchAdCreatives])

  // Platform preset effect
  useEffect(() => {
    if (platform !== 'custom') {
      const preset = PLATFORM_PRESETS[platform]
      setSource(preset.source)
      setMedium(preset.medium)
    }
  }, [platform])

  // Build URL effect
  useEffect(() => {
    buildUrl()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, source, medium, campaign, adGroup, content, term])

  function buildUrl() {
    if (!baseUrl.trim()) { setGeneratedUrl(''); return }
    try {
      const url = new URL(baseUrl.trim().startsWith('http') ? baseUrl.trim() : 'https://' + baseUrl.trim())
      if (source) url.searchParams.set('utm_source', source)
      if (medium) url.searchParams.set('utm_medium', medium)
      if (campaign) url.searchParams.set('utm_campaign', campaign)
      const contentVal = adGroup && content
        ? `${adGroup}_${content}`
        : adGroup || content
      if (contentVal) url.searchParams.set('utm_content', contentVal)
      if (term) url.searchParams.set('utm_term', term)
      setGeneratedUrl(url.toString())
    } catch {
      setGeneratedUrl('')
    }
  }

  function handleCopy() {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    toast.success('URL이 복사되었습니다.')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSaveLink() {
    if (!generatedUrl) return

    const label = historyLabel || `${PLATFORM_PRESETS[platform]?.label || platform} · ${campaign || '무제'}`
    const contentVal = adGroup && content ? `${adGroup}_${content}` : adGroup || content

    try {
      const res = await fetch('/api/utm/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_url: generatedUrl,
          utm_source: source || null,
          utm_medium: medium || null,
          utm_campaign: campaign || null,
          utm_content: contentVal || null,
          utm_term: term || null,
          label,
          client_id: selectedClientId, // 소재에서 선택된 client_id 사용
        }),
      })

      if (res.ok) {
        toast.success('히스토리에 저장되었습니다.')
        setHistoryLabel('')
        fetchLinks()
      } else {
        const data = await res.json()
        toast.error(data.error || '저장 실패')
      }
    } catch (err) {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  async function handleDeleteLink(id: number) {
    try {
      const res = await fetch(`/api/utm/links/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLinks(links.filter(l => l.id !== id))
        toast.success('삭제되었습니다.')
      }
    } catch (err) {
      toast.error('삭제 실패')
    }
  }

  function handleLoadLink(link: UtmLink) {
    try {
      const url = new URL(link.original_url)
      // UTM 파라미터를 제외한 기존 쿼리 파라미터 보존 (예: ?id=X)
      const baseParams = new URLSearchParams(url.search)
      ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(p => baseParams.delete(p))
      const baseQuery = baseParams.toString()
      setBaseUrl(url.origin + url.pathname + (baseQuery ? '?' + baseQuery : ''))
      setSource(link.utm_source || '')
      setMedium(link.utm_medium || '')
      setCampaign(link.utm_campaign || '')
      setContent(link.utm_content || '')
      setTerm(link.utm_term || '')
      setPlatform('custom')
      setSelectedTemplateId(null)
      toast.success('불러왔습니다.')
    } catch {
      toast.error('URL 파싱 실패')
    }
  }

  function applyTemplate(template: UtmTemplate) {
    if (template.base_url) setBaseUrl(template.base_url)
    if (template.utm_source) setSource(template.utm_source)
    if (template.utm_medium) setMedium(template.utm_medium)
    if (template.utm_campaign) setCampaign(template.utm_campaign)
    if (template.utm_content) setContent(template.utm_content)
    if (template.utm_term) setTerm(template.utm_term)
    if (template.platform) setPlatform(template.platform)
    else setPlatform('custom')
    setSelectedTemplateId(template.id)
  }

  async function handleSaveTemplate(name: string, isDefault: boolean) {
    const contentVal = adGroup && content ? `${adGroup}_${content}` : adGroup || content

    const res = await fetch('/api/utm/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        base_url: baseUrl || null,
        utm_source: source || null,
        utm_medium: medium || null,
        utm_campaign: campaign || null,
        utm_content: contentVal || null,
        utm_term: term || null,
        platform: platform !== 'custom' ? platform : null,
        is_default: isDefault,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '템플릿 저장 실패')
    }

    toast.success('템플릿이 저장되었습니다.')
  }

  async function handleDeleteTemplate(id: number) {
    const res = await fetch(`/api/utm/templates/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '템플릿 삭제 실패')
    }
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null)
    }
    toast.success('템플릿이 삭제되었습니다.')
  }

  function handleReset() {
    setBaseUrl('')
    setCampaign('')
    setAdGroup('')
    setContent('')
    setTerm('')
    setGeneratedUrl('')
    setSelectedTemplateId(null)
    setSelectedLandingPage('')
    setSelectedCreative('')
  }

  function handleLandingPageSelect(lpId: string) {
    setSelectedLandingPage(lpId)
    setSelectedCreative('') // 소재 선택 해제
    if (lpId && lpId !== 'manual') {
      // 현재 도메인 기준으로 랜딩 페이지 URL 설정
      const lpUrl = `${window.location.origin}/lp?id=${lpId}`
      setBaseUrl(lpUrl)
    }
  }

  function handleCreativeSelect(creativeId: string) {
    setSelectedCreative(creativeId)
    if (creativeId && creativeId !== 'manual') {
      const creative = adCreatives.find(c => c.id === Number(creativeId))
      if (creative) {
        // client_id 저장 (링크 저장 시 사용)
        setSelectedClientId(creative.client_id)

        // utm_content 자동 설정
        setContent(creative.utm_content)
        setAdGroup('') // 광고그룹 초기화 (소재에서 직접 설정하므로)

        // 소재에 설정된 UTM 파라미터 자동 적용
        if (creative.utm_source) {
          setSource(creative.utm_source)
          // platform을 custom으로 설정하여 source/medium 직접 입력 모드로
          setPlatform('custom')
        }
        if (creative.utm_medium) {
          setMedium(creative.utm_medium)
        }
        if (creative.utm_campaign) {
          setCampaign(creative.utm_campaign)
        }
        if (creative.utm_term) {
          setTerm(creative.utm_term)
        }

        // 연결된 랜딩 페이지가 있으면 자동 선택
        if (creative.landing_page_id) {
          setSelectedLandingPage(String(creative.landing_page_id))
          const lpUrl = `${window.location.origin}/lp?id=${creative.landing_page_id}`
          setBaseUrl(lpUrl)
        }

        // 플랫폼이 설정되어 있고, UTM source가 없으면 플랫폼 프리셋 적용
        if (creative.platform && PLATFORM_PRESETS[creative.platform] && !creative.utm_source) {
          setPlatform(creative.platform)
          const preset = PLATFORM_PRESETS[creative.platform]
          setSource(preset.source)
          setMedium(preset.medium)
        }

        toast.success(`"${creative.name}" 소재가 적용되었습니다.`)
      }
    } else {
      setSelectedClientId(null)
    }
  }

  const currentFormData: TemplateFormData = {
    baseUrl,
    source,
    medium,
    campaign,
    content: adGroup && content ? `${adGroup}_${content}` : adGroup || content,
    term,
    platform,
  }

  const params = [
    { label: 'utm_source', value: source },
    { label: 'utm_medium', value: medium },
    { label: 'utm_campaign', value: campaign },
    { label: 'utm_content', value: adGroup && content ? `${adGroup}_${content}` : adGroup || content },
    { label: 'utm_term', value: term },
  ].filter(p => p.value)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={14} /> UTM 목록
        </Button>
        <h1 className="text-2xl font-bold text-foreground">UTM 생성</h1>
        <p className="text-sm text-muted-foreground mt-1">광고 매체 및 콘텐츠 유입 추적을 위한 UTM 파라미터 URL 생성</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 입력 영역 */}
        <div className="lg:col-span-2 space-y-5">

          {/* 템플릿 선택 */}
          <Card variant="glass" className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground/80">템플릿</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTemplates}
                disabled={templatesLoading}
              >
                <RefreshCw className={`h-4 w-4 ${templatesLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <TemplateSelector
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              currentFormData={currentFormData}
              onSelectTemplate={applyTemplate}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onRefresh={fetchTemplates}
              disabled={templatesLoading}
            />
          </Card>

          {/* 광고 소재 선택 */}
          {adCreatives.length > 0 && (
            <Card variant="glass" className="p-5 border-brand-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Image size={14} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-foreground/80">광고 소재 선택</h2>
                <span className="text-xs text-muted-foreground">(utm_content + 랜딩 페이지 자동 연결)</span>
              </div>
              <Select
                value={selectedCreative}
                onValueChange={handleCreativeSelect}
                disabled={adCreativesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="소재 선택 시 utm_content와 랜딩 페이지가 자동 설정됩니다" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">직접 입력</SelectItem>
                  {adCreatives.map(creative => (
                    <SelectItem key={creative.id} value={String(creative.id)}>
                      {creative.name} → {creative.utm_content}
                      {creative.landing_page && ` (${creative.landing_page.name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCreative && (
                <p className="text-xs text-emerald-400 mt-2">
                  → utm_content와 랜딩 페이지가 자동으로 설정되었습니다
                </p>
              )}
            </Card>
          )}

          {/* 랜딩 페이지 선택 */}
          {landingPages.length > 0 && (
            <Card variant="glass" className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-foreground/80">랜딩 페이지 선택</h2>
                {selectedCreative && <span className="text-xs text-emerald-400">(소재에서 자동 설정됨)</span>}
              </div>
              <Select
                value={selectedLandingPage}
                onValueChange={handleLandingPageSelect}
                disabled={landingPagesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="랜딩 페이지 선택 (선택 시 기본 URL 자동 입력)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">직접 입력</SelectItem>
                  {landingPages.map(lp => (
                    <SelectItem key={lp.id} value={String(lp.id)}>
                      {lp.name} {lp.client?.name ? `(${lp.client.name})` : '(미배정)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLandingPage && (
                <p className="text-xs text-brand-400 mt-2">
                  → 기본 URL이 자동으로 설정되었습니다: /lp?id={selectedLandingPage}
                </p>
              )}
            </Card>
          )}

          {/* 기본 URL */}
          <Card variant="glass" className="p-5">
            <h2 className="text-sm font-semibold text-foreground/80 mb-3">기본 URL</h2>
            <Input
              value={baseUrl}
              onChange={e => {
                setBaseUrl(e.target.value)
                // 수동 입력 시 랜딩 페이지 선택 해제
                if (selectedLandingPage) setSelectedLandingPage('')
              }}
              placeholder="https://example.com/landing"
            />
          </Card>

          {/* 매체 선택 */}
          <Card variant="glass" className="p-5">
            <h2 className="text-sm font-semibold text-foreground/80 mb-4">매체 선택</h2>

            {GROUPS.map(group => {
              const items = Object.entries(PLATFORM_PRESETS).filter(([, p]) => p.group === group)
              return (
                <div key={group} className="mb-4 last:mb-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(([key, preset]) => (
                      <Button
                        key={key}
                        variant={platform === key ? 'default' : 'glass'}
                        size="sm"
                        onClick={() => setPlatform(key)}
                        className={platform === key ? 'bg-brand-600' : ''}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border dark:border-white/5">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  utm_source *
                  {platform !== 'custom' && (
                    <span className="ml-1 text-brand-400">(자동입력)</span>
                  )}
                </Label>
                <Input
                  value={source}
                  onChange={e => { setSource(e.target.value); setPlatform('custom') }}
                  placeholder="meta"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  utm_medium *
                  {platform !== 'custom' && (
                    <span className="ml-1 text-brand-400">(자동입력)</span>
                  )}
                </Label>
                <Input
                  value={medium}
                  onChange={e => { setMedium(e.target.value); setPlatform('custom') }}
                  placeholder="cpc"
                />
              </div>
            </div>
          </Card>

          {/* 캠페인 정보 */}
          <Card variant="glass" className="p-5">
            <h2 className="text-sm font-semibold text-foreground/80 mb-3">캠페인 정보</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  utm_campaign <span className="text-muted-foreground/60">(캠페인명)</span>
                </Label>
                <Input
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="예: 2026_spring_promo"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  광고그룹 <span className="text-muted-foreground/60">(utm_content 앞에 prefix로 결합)</span>
                </Label>
                <Input
                  value={adGroup}
                  onChange={e => setAdGroup(e.target.value)}
                  placeholder="예: adset_women_30s"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  utm_content <span className="text-muted-foreground/60">(광고소재 / 콘텐츠명)</span>
                </Label>
                <Input
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="예: video_before_after"
                />
                {adGroup && content && (
                  <p className="text-xs text-brand-400 mt-1">→ utm_content = <strong>{adGroup}_{content}</strong></p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  utm_term <span className="text-muted-foreground/60">(키워드 — 검색광고 전용)</span>
                </Label>
                <Input
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  placeholder="예: 강남성형외과"
                />
              </div>
            </div>
          </Card>

          {/* 생성된 URL */}
          {generatedUrl && (
            <Card variant="glass" className="p-5 border-brand-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Link2 size={14} className="text-brand-400" />
                  <h2 className="text-sm font-semibold text-foreground">생성된 URL</h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="glass" size="sm" onClick={() => setQrDialogOpen(true)}>
                    <QrCode size={12} /> QR
                  </Button>
                  <Button variant="glass" size="sm" asChild>
                    <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={12} /> 열기
                    </a>
                  </Button>
                  <Button size="sm" onClick={handleCopy}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? '복사됨' : '복사'}
                  </Button>
                </div>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-border dark:border-white/5">
                <p className="text-xs text-brand-300 break-all font-mono">
                  {generatedUrl}
                </p>
              </div>

              {params.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {params.map(p => (
                    <span key={p.label} className="inline-flex items-center gap-1 px-2 py-1 bg-muted dark:bg-white/5 border border-border dark:border-white/10 rounded text-xs">
                      <span className="text-muted-foreground">{p.label}=</span>
                      <span className="text-brand-400 font-medium">{p.value}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* 히스토리 저장 */}
              <div className="mt-4 flex gap-2">
                <Input
                  value={historyLabel}
                  onChange={e => setHistoryLabel(e.target.value)}
                  placeholder="저장 이름 (선택)"
                  className="flex-1 h-8 text-xs"
                />
                <Button variant="glass" size="sm" onClick={handleSaveLink}>
                  <Database size={12} className="mr-1" />
                  저장
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  초기화
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* 히스토리 사이드바 */}
        <div className="lg:col-span-1">
          <Card variant="glass" className="p-5 sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2"
                aria-expanded={showHistory}
                aria-label={`히스토리 ${showHistory ? '접기' : '펼치기'}`}
              >
                <h2 className="text-sm font-semibold text-foreground/80">
                  생성된 UTM 목록
                  {links.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-brand-500/20 text-brand-400 rounded-full">
                      {links.length}
                    </span>
                  )}
                </h2>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLinks}
                disabled={linksLoading}
              >
                <RefreshCw className={`h-3 w-3 ${linksLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {(showHistory || links.length === 0) && (
              <>
                {/* 검색 필터 */}
                {links.length > 0 && (
                  <div className="mb-3">
                    <Input
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      placeholder="캠페인, 소스, 라벨 검색..."
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                {linksLoading ? (
                  <div className="text-xs text-muted-foreground text-center py-6">불러오는 중...</div>
                ) : links.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    생성된 URL을 저장하면<br />여기에 표시됩니다.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredLinks.map(item => (
                      <div key={item.id} className="border border-border dark:border-white/5 rounded-lg p-3 hover:bg-muted dark:hover:bg-white/[0.03] transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{item.label || '무제'}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {toUtcDate(item.created_at).toLocaleDateString('ko-KR', DATE_FORMAT_OPTIONS)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteLink(item.id)}
                            className="text-muted-foreground/60 hover:text-red-400 shrink-0 transition-colors"
                            aria-label={`${item.label} 삭제`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* UTM 파라미터 표시 */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.utm_source && (
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded">
                              {item.utm_source}
                            </span>
                          )}
                          {item.utm_medium && (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] rounded">
                              {item.utm_medium}
                            </span>
                          )}
                          {item.utm_campaign && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded truncate max-w-[100px]" title={item.utm_campaign}>
                              {item.utm_campaign}
                            </span>
                          )}
                          {item.utm_content && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded truncate max-w-[80px]" title={item.utm_content}>
                              {item.utm_content}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-muted-foreground/60 truncate mt-2 font-mono">{item.original_url}</p>
                        <div className="flex gap-2 mt-2 pt-2 border-t border-border dark:border-white/5">
                          <button
                            onClick={() => { navigator.clipboard.writeText(item.original_url); toast.success('복사됨') }}
                            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                          >
                            <Copy className="w-3 h-3" /> 복사
                          </button>
                          <button
                            onClick={() => handleLoadLink(item)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <RefreshCw className="w-3 h-3" /> 불러오기
                          </button>
                          <a
                            href={item.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-3 h-3" /> 열기
                          </a>
                        </div>
                      </div>
                    ))}
                    {historySearch && filteredLinks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        검색 결과가 없습니다.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {!showHistory && links.length > 0 && (
              <p className="text-xs text-muted-foreground">{links.length}개 저장됨. 클릭하여 펼치기</p>
            )}
          </Card>

          {/* 파라미터 가이드 */}
          <Card variant="glass" className="p-5 mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3">파라미터 가이드</h3>
            <dl className="space-y-2 text-xs text-muted-foreground">
              <div>
                <dt className="font-medium text-muted-foreground">utm_source</dt>
                <dd>유입 출처: meta, google, naver, tiktok</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">utm_medium</dt>
                <dd>채널 유형: cpc, display, video, short, social, blog</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">utm_campaign</dt>
                <dd>캠페인명 또는 코드</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">utm_content</dt>
                <dd>광고소재 / 콘텐츠 구분</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">utm_term</dt>
                <dd>검색 키워드 (SA 전용)</dd>
              </div>
            </dl>

            <div className="mt-4 pt-3 border-t border-border dark:border-white/5">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">medium 기본값</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><span className="text-muted-foreground font-medium">cpc</span> — Meta, Google SA, 네이버SA, 카카오</p>
                <p><span className="text-muted-foreground font-medium">display</span> — 네이버 DA</p>
                <p><span className="text-muted-foreground font-medium">video</span> — 유튜브</p>
                <p><span className="text-muted-foreground font-medium">short</span> — 쇼츠, 릴스, 틱톡</p>
                <p><span className="text-muted-foreground font-medium">social</span> — 인스타 피드 (오가닉)</p>
                <p><span className="text-muted-foreground font-medium">blog</span> — 네이버 블로그</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* QR Code Dialog */}
      <QRCodeDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        url={generatedUrl}
        label={campaign || PLATFORM_PRESETS[platform]?.label}
      />
    </div>
  )
}
