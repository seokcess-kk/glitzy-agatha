'use client'
import { useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/common'

const MENU_OPTIONS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'campaigns', label: '캠페인 리드' },
  { key: 'leads', label: '고객(CDP)' },
  { key: 'patients', label: '예약/결제' },
  { key: 'ads', label: '광고 성과' },
  { key: 'content', label: '콘텐츠 분석' },
  { key: 'monitor', label: '콘텐츠 모니터링' },
  { key: 'press', label: '언론보도' },
  { key: 'monitoring', label: '순위 현황' },
  { key: 'medichecker', label: '원고 검수' },
  { key: 'erp-documents', label: '견적/계산서' },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user

  const [hiddenMenus, setHiddenMenus] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/')
  }, [user, router])

  useEffect(() => {
    fetch('/api/admin/menu-settings')
      .then(r => r.json())
      .then(d => setHiddenMenus(d.hiddenMenus || []))
      .catch(() => toast.error('설정 로드 실패'))
      .finally(() => setLoading(false))
  }, [])

  const toggleMenu = async (menuKey: string, visible: boolean) => {
    const updated = visible
      ? hiddenMenus.filter(k => k !== menuKey)
      : [...hiddenMenus, menuKey]

    setHiddenMenus(updated)
    setSaving(true)

    try {
      const res = await fetch('/api/admin/menu-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenMenus: updated }),
      })
      if (!res.ok) throw new Error()
      toast.success(visible ? '메뉴가 표시됩니다' : '메뉴가 숨겨집니다')
    } catch {
      // 롤백
      setHiddenMenus(hiddenMenus)
      toast.error('설정 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'superadmin') return null

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="시스템 설정"
        description="전역 시스템 설정을 관리합니다"
      />

      <Card variant="glass" className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">메뉴 표시 설정</h3>
        <p className="text-xs text-muted-foreground mb-5">
          토글을 꺼서 사이드바에서 메뉴를 숨길 수 있습니다. 모든 사용자에게 적용됩니다.
        </p>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {MENU_OPTIONS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Label htmlFor={`menu-${key}`} className="text-sm font-medium cursor-pointer">
                  {label}
                </Label>
                <Switch
                  id={`menu-${key}`}
                  checked={!hiddenMenus.includes(key)}
                  onCheckedChange={(checked) => toggleMenu(key, checked)}
                  disabled={saving}
                  aria-label={`${label} 메뉴 ${hiddenMenus.includes(key) ? '표시' : '숨김'}`}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
