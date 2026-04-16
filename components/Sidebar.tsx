'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { LayoutDashboard, Users, BarChart2, LogOut, Activity, Calendar, Film, Link2, Scan, Newspaper, ChevronUp, User, ClipboardList, LucideIcon, Building2, UserCog, FileText, Image as ImageIcon, Megaphone, TrendingUp, Shield, KeyRound, ShieldCheck, Receipt, Settings2 } from 'lucide-react'
import { useClient } from './ClientContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// 메뉴 타입 정의
// minRole: 1=client_staff, 2=client_admin/agency_staff, 3=superadmin
interface MenuItem {
  href: string
  label: string
  icon: LucideIcon
  minRole?: number
  menuKey?: string // agency_staff 메뉴 권한 필터용
  hidden?: boolean // 코드 레벨 숨김 (DB 동적 숨김은 hiddenMenuKeys로 처리)
}

interface MenuGroup {
  label?: string
  items: MenuItem[]
  minRole?: number
}

const ROLE_LEVEL: Record<string, number> = {
  client_staff: 1,
  agency_staff: 2,
  client_admin: 2,
  superadmin: 3,
  demo_viewer: 3,
}

// 그룹별 메뉴 구조
const menuGroups: MenuGroup[] = [
  {
    items: [
      { href: '/', label: '대시보드', icon: LayoutDashboard, minRole: 2, menuKey: 'dashboard' },
    ]
  },
  {
    label: '고객관리',
    items: [
      { href: '/campaigns', label: '캠페인 리드', icon: Megaphone, menuKey: 'campaigns' },
      { href: '/leads', label: '고객', icon: Users, menuKey: 'leads' },
      { href: '/patients', label: '예약/결제', icon: Calendar, menuKey: 'patients' },
    ]
  },
  {
    label: '마케팅 분석',
    minRole: 2,
    items: [
      { href: '/ads', label: '광고 성과', icon: BarChart2, menuKey: 'ads' },
      { href: '/content', label: '콘텐츠 분석', icon: Film, menuKey: 'content' },
      { href: '/monitor', label: '콘텐츠 모니터링', icon: Scan, menuKey: 'monitor' },
    ]
  },
  {
    items: [
      { href: '/press', label: '언론보도', icon: Newspaper, menuKey: 'press' },
    ]
  },
  {
    label: '순위 모니터링',
    minRole: 2,
    items: [
      { href: '/monitoring', label: '순위 현황', icon: TrendingUp, menuKey: 'monitoring' },
    ]
  },
  {
    label: '원고 검수',
    minRole: 2,
    items: [
      { href: '/medichecker', label: '원고 검수', icon: ShieldCheck, menuKey: 'medichecker' },
    ]
  },
  {
    label: '견적/계산서',
    minRole: 2,
    items: [
      { href: '/erp-documents', label: '견적/계산서', icon: Receipt, menuKey: 'erp-documents' },
    ]
  },
]

// 비밀번호 변경 다이얼로그 (lazy import 불필요 — 사이드바는 항상 마운트)
import PasswordChangeDialog from '@/components/PasswordChangeDialog'
import ThemeToggle from '@/components/ThemeToggle'

function navLinkClass(isActive: boolean): string {
  return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${isActive
      ? 'bg-brand-600/20 text-brand-400'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }`
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const userRole = user?.role || 'client_staff'
  const userLevel = ROLE_LEVEL[userRole] || 1
  const isSuperAdmin = userRole === 'superadmin'
  const isClientAdmin = userRole === 'client_admin'
  const isAgencyStaff = userRole === 'agency_staff'
  const isDemoViewer = userRole === 'demo_viewer'

  const [pwDialogOpen, setPwDialogOpen] = useState(false)
  const { selectedClientId, setSelectedClientId, clients } = useClient()
  const selectedClient = clients.find(c => c.id === selectedClientId)

  // agency_staff 메뉴 권한
  const [menuPermissions, setMenuPermissions] = useState<string[]>([])
  const [menuLoaded, setMenuLoaded] = useState(false)
  // 시스템 전역 숨김 메뉴
  const [hiddenMenuKeys, setHiddenMenuKeys] = useState<string[]>([])

  useEffect(() => {
    // 시스템 숨김 메뉴 조회
    fetch('/api/menu-visibility')
      .then(r => r.json())
      .then(d => setHiddenMenuKeys(d.hiddenMenus || []))
      .catch(() => {/* 실패 시 숨김 없음 */})

    if (isAgencyStaff) {
      fetch('/api/my/menu-permissions')
        .then(r => r.json())
        .then(d => {
          if (d.all) setMenuPermissions([])
          else setMenuPermissions(d.permissions || [])
          setMenuLoaded(true)
        })
        .catch(() => setMenuLoaded(true))
    } else {
      setMenuLoaded(true)
    }
  }, [isAgencyStaff])

  // 메뉴 필터: agency_staff는 허용된 menuKey만 표시
  const filterMenuItem = (item: MenuItem): boolean => {
    // 시스템 전역 숨김 (슈퍼어드민도 숨김)
    if (item.menuKey && hiddenMenuKeys.includes(item.menuKey)) return false
    if (!isAgencyStaff) return true
    if (!item.menuKey) return true
    if (menuPermissions.length === 0 && menuLoaded) return true // 권한 미설정 시 전체 허용
    return menuPermissions.includes(item.menuKey)
  }

  return (
    <aside className="w-60 h-screen flex flex-col border-r border-border shrink-0 bg-background">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Agatha</p>
          <p className="text-xs text-muted-foreground">Marketing Intelligence</p>
        </div>
        <ThemeToggle />
      </div>

      {/* 슈퍼어드민 / agency_staff / demo_viewer: 클리닉 스위처 */}
      {(isSuperAdmin || isAgencyStaff || isDemoViewer) && (
        <div className="px-3 py-3 border-b border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 px-1">클라이언트 선택</p>
          <Select
            value={selectedClientId?.toString() ?? 'all'}
            onValueChange={v => setSelectedClientId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder="전체 클라이언트" />
            </SelectTrigger>
            <SelectContent>
              {(isSuperAdmin || isDemoViewer) && <SelectItem value="all">전체 클라이언트</SelectItem>}
              {clients.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClient && (
            <p className="text-[10px] text-brand-400 mt-1.5 px-1">{selectedClient.name} 데이터 조회 중</p>
          )}
        </div>
      )}


      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {menuGroups.filter(g => userLevel >= (g.minRole || 1)).map((group, groupIndex) => {
          const visibleItems = group.items
            .filter(item => userLevel >= (item.minRole || 1))
            .filter(filterMenuItem)
          if (visibleItems.length === 0) return null
          return (
            <div key={groupIndex}>
              {/* 그룹 헤더 */}
              {group.label && (
                <div className="pt-4 pb-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3">
                    {group.label}
                  </p>
                </div>
              )}
              {/* 그룹 아이템 */}
              <div className="space-y-1">
                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const exactMatch = pathname === href
                  const prefixMatch = href !== '/' && pathname.startsWith(href + '/')
                  // 같은 그룹 내 더 구체적인 경로가 매칭되면 상위 경로는 비활성화
                  const overridden = !exactMatch && prefixMatch && visibleItems.some(other => other.href !== href && pathname.startsWith(other.href) && other.href.startsWith(href + '/'))
                  const isActive = exactMatch || (prefixMatch && !overridden)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={navLinkClass(isActive)}
                    >
                      <Icon size={17} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* client_admin 전용: 담당자 관리 */}
        {isClientAdmin && (
          <div className="space-y-1 mt-2">
            <div className="pt-4 pb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3">관리</p>
            </div>
            <Link
              href="/staff"
              onClick={onClose}
              className={navLinkClass(pathname === '/staff')}
            >
              <UserCog size={17} />
              담당자 관리
            </Link>
          </div>
        )}

        {/* 슈퍼어드민 전용 메뉴 */}
        {isSuperAdmin && (
          <>
            <div className="pt-4 pb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3">슈퍼어드민</p>
            </div>
            <div className="space-y-1">
              <Link
                href="/admin/ad-creatives" onClick={onClose}
                className={navLinkClass(pathname === '/admin/ad-creatives')}
              >
                <ImageIcon size={17} />
                광고 소재
              </Link>
              <Link
                href="/admin/landing-pages" onClick={onClose}
                className={navLinkClass(pathname === '/admin/landing-pages')}
              >
                <FileText size={17} />
                랜딩 페이지
              </Link>
              <Link
                href="/admin/clients" onClick={onClose}
                className={navLinkClass(pathname === '/admin/clients')}
              >
                <Building2 size={17} />
                클라이언트 관리
              </Link>
              <Link
                href="/admin/users" onClick={onClose}
                className={navLinkClass(pathname === '/admin/users')}
              >
                <UserCog size={17} />
                계정 관리
              </Link>
              <Link
                href="/utm" onClick={onClose}
                className={navLinkClass(pathname.startsWith('/utm'))}
              >
                <Link2 size={17} />
                UTM 생성
              </Link>
              <Link
                href="/lead-form" onClick={onClose}
                className={navLinkClass(pathname === '/lead-form')}
              >
                <ClipboardList size={17} />
                리드 수집
              </Link>
              <Link
                href="/admin/login-logs" onClick={onClose}
                className={navLinkClass(pathname === '/admin/login-logs')}
              >
                <Shield size={17} />
                로그인 로그
              </Link>
              <Link
                href="/admin/settings" onClick={onClose}
                className={navLinkClass(pathname === '/admin/settings')}
              >
                <Settings2 size={17} />
                시스템 설정
              </Link>
            </div>
          </>
        )}
      </nav>

      {/* 사용자 메뉴 */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors duration-200 text-left cursor-pointer" aria-label="사용자 메뉴">
              <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
                {(user?.name || user?.username)?.[0]?.toUpperCase() || <User size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">{user?.name || user?.username}</p>
                <p className="text-[10px] text-muted-foreground">
                  {isSuperAdmin ? '슈퍼어드민' : isAgencyStaff ? '에이전시 담당자' : isClientAdmin ? '클라이언트 관리자' : '클라이언트 담당자'}
                </p>
              </div>
              <ChevronUp size={14} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel>
              {user?.name || user?.username}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPwDialogOpen(true)}>
              <KeyRound size={14} />
              비밀번호 변경
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-red-500 hover:text-red-600 focus:text-red-600 dark:text-red-400 dark:hover:text-red-300 dark:focus:text-red-300"
            >
              <LogOut size={14} />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PasswordChangeDialog open={pwDialogOpen} onOpenChange={setPwDialogOpen} />
      </div>
    </aside>
  )
}
