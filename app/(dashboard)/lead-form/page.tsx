'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Send, CheckCircle, AlertCircle, Loader2, Link2, Tag } from 'lucide-react'
import { useClient } from '@/components/ClientContext'
import { getUtmSourceLabel, getUtmMediumLabel } from '@/lib/utm'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/common'

function LeadFormContent() {
  const searchParams = useSearchParams()
  const { selectedClientId } = useClient()

  // 폼 입력
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  // UTM 파라미터 (URL에서 자동 추출)
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [utmContent, setUtmContent] = useState('')
  const [utmTerm, setUtmTerm] = useState('')

  // 상태
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null)

  // URL에서 UTM 파라미터 자동 추출
  useEffect(() => {
    setUtmSource(searchParams.get('utm_source') || '')
    setUtmMedium(searchParams.get('utm_medium') || '')
    setUtmCampaign(searchParams.get('utm_campaign') || '')
    setUtmContent(searchParams.get('utm_content') || '')
    setUtmTerm(searchParams.get('utm_term') || '')
  }, [searchParams])

  // 전화번호 자동 포맷팅
  const handlePhoneChange = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) {
      setPhoneNumber(numbers)
    } else if (numbers.length <= 7) {
      setPhoneNumber(`${numbers.slice(0, 3)}-${numbers.slice(3)}`)
    } else {
      setPhoneNumber(`${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/webhook/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          phoneNumber,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
          utm_content: utmContent || undefined,
          utm_term: utmTerm || undefined,
          inflowUrl: window.location.href,
          client_id: selectedClientId || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: '리드가 성공적으로 등록되었습니다.',
          data,
        })
        // 폼 초기화
        setName('')
        setPhoneNumber('')
      } else {
        setResult({
          success: false,
          message: data.error || '등록에 실패했습니다.',
        })
      }
    } catch {
      setResult({
        success: false,
        message: '서버 연결에 실패했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  const hasUtmParams = utmSource || utmMedium || utmCampaign || utmContent || utmTerm

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="리드 수집" description="URL에 UTM 파라미터를 추가하여 유입 추적을 테스트할 수 있습니다." />

      {/* UTM 파라미터 표시 */}
      {hasUtmParams && (
        <Card variant="glass" className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={14} className="text-brand-400" />
            <span className="text-xs font-semibold text-foreground/80">감지된 UTM 파라미터</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {utmSource && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                source: <strong>{getUtmSourceLabel(utmSource)}</strong>
              </Badge>
            )}
            {utmMedium && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                medium: <strong>{getUtmMediumLabel(utmMedium)}</strong>
              </Badge>
            )}
            {utmCampaign && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                campaign: <strong>{utmCampaign}</strong>
              </Badge>
            )}
            {utmContent && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                content: <strong>{utmContent}</strong>
              </Badge>
            )}
            {utmTerm && (
              <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">
                term: <strong>{utmTerm}</strong>
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* 클라이언트 미선택 경고 */}
      {!selectedClientId && (
        <Card variant="glass" className="p-4 mb-6 border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400" />
            <span className="text-sm text-amber-300">클라이언트을 먼저 선택해주세요</span>
          </div>
        </Card>
      )}

      {/* 리드 입력 폼 */}
      <Card variant="glass" className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>
              이름 <span className="text-muted-foreground">(선택)</span>
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
            />
          </div>

          <div className="space-y-2">
            <Label>
              전화번호 <span className="text-red-400">*</span>
            </Label>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="010-1234-5678"
              required
            />
          </div>

          {/* UTM 수동 입력 (접힌 상태) */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground/80">
              <Tag size={14} />
              UTM 파라미터 직접 입력
            </summary>
            <div className="mt-4 space-y-3 pl-5 border-l border-border dark:border-white/10">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">utm_source</Label>
                  <Input
                    type="text"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    placeholder="meta"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">utm_medium</Label>
                  <Input
                    type="text"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    placeholder="cpc"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">utm_campaign</Label>
                <Input
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="spring_promo_2024"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">utm_content</Label>
                <Input
                  type="text"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                  placeholder="banner_v1"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">utm_term</Label>
                <Input
                  type="text"
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                  placeholder="keyword"
                  className="h-9"
                />
              </div>
            </div>
          </details>

          <Button
            type="submit"
            disabled={loading || !phoneNumber || !selectedClientId}
            className="w-full bg-brand-600 hover:bg-brand-700"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Send size={18} />
                리드 등록
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* 결과 표시 */}
      {result && (
        <Card
          variant="glass"
          className={`mt-6 p-4 flex items-start gap-3 ${
            result.success
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          {result.success ? (
            <CheckCircle size={20} className="text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`font-medium ${result.success ? 'text-emerald-300' : 'text-red-300'}`}>
              {result.message}
            </p>
            {result.data && (
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                <p>Lead ID: {result.data.leadId}</p>
                <p>Contact ID: {result.data.contactId}</p>
                <p>신규 고객: {result.data.isNewContact ? '예' : '아니오 (재방문)'}</p>
                {result.data.utm && (
                  <p className="text-brand-400">
                    UTM: {result.data.utm.utm_source || '-'} / {result.data.utm.utm_campaign || '-'}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 테스트 URL 안내 */}
      <Card variant="glass" className="mt-8 p-4">
        <h3 className="text-sm font-semibold text-foreground/80 mb-2">테스트 URL 예시</h3>
        <div className="space-y-2">
          <code className="block text-xs text-muted-foreground bg-black/30 p-2 rounded overflow-x-auto">
            /lead-form?utm_source=meta&utm_medium=cpc&utm_campaign=spring_promo
          </code>
          <code className="block text-xs text-muted-foreground bg-black/30 p-2 rounded overflow-x-auto">
            /lead-form?utm_source=google&utm_campaign=search_brand&utm_term=강남성형외과
          </code>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          위 URL로 접속하면 UTM 파라미터가 자동으로 감지됩니다.
        </p>
      </Card>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card variant="glass" className="p-6 space-y-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-12" />
      </Card>
    </div>
  )
}

export default function LeadFormPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  if (user?.role !== 'superadmin') return null

  return (
    <Suspense fallback={<LoadingFallback />}>
      <LeadFormContent />
    </Suspense>
  )
}
