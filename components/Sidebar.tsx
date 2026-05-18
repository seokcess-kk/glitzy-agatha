'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  LayoutDashboard, Users, BarChart3, LogOut, Activity, Calendar, Film, Link2, Scan, Newspaper,
  ChevronUp, User, ClipboardList, LucideIcon, Building2, UserCog, FileText, Image as ImageIcon,
  Megaphone, TrendingUp, Shield, KeyRound, ShieldCheck, Receipt, Settings, Pin, PinOff,
} from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// 메뉴 타입 정의
// minRole: 1=client_staff, 2=client_admin/agency_staff, 3=superadmin
interface MenuItem {
  href: string
  label: string
  icon: LucideIcon
  minRole?: number
  menuKey?: string
  hidden?: boolean
  /** 상위 항목의 하위 뷰처럼 표시할 때 true (들여쓰기 + 보조 스타일). 예: /ads?tab=campaigns deep link */
  subItem?: boolean
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

const PINNED_KEY = 'agatha_sidebar_pinned'

// 일반 메뉴 그룹
const generalMenuGroups: MenuGroup[] = [
  {
    items: [
      { href: '/', label: '대시보드', icon: LayoutDashboard, menuKey: 'dashboard' },
    ]
  },
  {
    items: [
      { href: '/ads', label: '광고 성과', icon: BarChart3, menuKey: 'ads' },
      // /ads 의 캠페인 분석 탭 deep link. menuKey 는 기존 권한 호환을 위해 'campaigns' 유지.
      { href: '/ads?tab=campaigns', label: '캠페인 분석', icon: Megaphone, menuKey: 'campaigns', subItem: true },
    ]
  },
  {
    items: [
      { href: '/customers', label: '리드·고객', icon: Users, menuKey: 'leads' },
    ]
  },
  {
    items: [
      { href: '/monitoring', label: '순위 모니터링', icon: TrendingUp, minRole: 2, menuKey: 'monitoring' },
    ]
  },
  {
    items: [
      { href: '/erp-documents', label: '견적/계산서', icon: Receipt, minRole: 2, menuKey: 'erp-documents' },
    ]
  },
]

// 관리 메뉴 (superadmin 전용)
const adminMenuItems: MenuItem[] = [
  { href: '/admin/clients', label: '클라이언트', icon: Building2, minRole: 3, menuKey: 'admin-clients' },
  { href: '/admin/users', label: '계정 관리', icon: UserCog, minRole: 3, menuKey: 'admin-users' },
  { href: '/admin/ad-creatives', label: '광고 소재', icon: ImageIcon, minRole: 3, menuKey: 'admin-creatives' },
  { href: '/admin/landing-pages', label: '랜딩페이지', icon: FileText, minRole: 3, menuKey: 'admin-landing' },
  { href: '/utm', label: 'UTM 관리', icon: Link2, minRole: 3, menuKey: 'utm' },
  { href: '/admin/settings', label: '설정', icon: Settings, minRole: 3, menuKey: 'admin-settings' },
]

// 비밀번호 변경 다이얼로그
import PasswordChangeDialog from '@/components/PasswordChangeDialog'
import ThemeToggle from '@/components/ThemeToggle'

interface SidebarProps {
  onClose?: () => void
  collapsed?: boolean
  pinned?: boolean
  onTogglePin?: () => void
  onDropdownOpenChange?: (open: boolean) => void
}

// useSearchParams 사용 컴포넌트는 prerender 시 Suspense boundary 필요. 외부 default export 가 감싸준다.
export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<aside className={`${props.collapsed ? 'w-16' : 'w-60'} h-screen border-r border-border bg-background shrink-0`} />}>
      <SidebarInner {...props} />
    </Suspense>
  )
}

function SidebarInner({ onClose, collapsed: controlledCollapsed, pinned: controlledPinned, onTogglePin, onDropdownOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

  // 내부 상태 (외부 제어가 없을 때 사용)
  const [internalPinned, setInternalPinned] = useState(false)
  const pinned = controlledPinned ?? internalPinned
  const collapsed = controlledCollapsed ?? !pinned

  useEffect(() => {
    if (controlledPinned === undefined) {
      try {
        const saved = localStorage.getItem(PINNED_KEY)
        if (saved === 'true') setInternalPinned(true)
      } catch {}
    }
  }, [controlledPinned])

  const togglePin = useCallback(() => {
    if (onTogglePin) {
      onTogglePin()
    } else {
      setInternalPinned(prev => {
        const next = !prev
        try { localStorage.setItem(PINNED_KEY, String(next)) } catch {}
        return next
      })
    }
  }, [onTogglePin])

  // agency_staff 메뉴 권한
  const [menuPermissions, setMenuPermissions] = useState<string[]>([])
  const [menuLoaded, setMenuLoaded] = useState(false)
  const [hiddenMenuKeys, setHiddenMenuKeys] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/menu-visibility')
      .then(r => r.json())
      .then(d => setHiddenMenuKeys(d.hiddenMenus || []))
      .catch(() => {})

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

  const filterMenuItem = (item: MenuItem): boolean => {
    if (item.menuKey && hiddenMenuKeys.includes(item.menuKey)) return false
    if (!isAgencyStaff) return true
    if (!item.menuKey) return true
    if (menuPermissions.length === 0 && menuLoaded) return true
    return menuPermissions.includes(item.menuKey)
  }

  // querystring 매칭 헬퍼 — href 의 모든 ?key=value 가 현재 searchParams 와 일치하는지
  const matchesQuery = (hrefQuery: string) => {
    const required = new URLSearchParams(hrefQuery)
    for (const [k, v] of required) {
      if (searchParams?.get(k) !== v) return false
    }
    return true
  }

  const isActive = (href: string, allItems: MenuItem[] = []) => {
    const [hrefPath, hrefQuery] = href.split('?')

    // Deep link 항목 (querystring 포함): pathname + 모든 query 매칭
    if (hrefQuery) {
      return pathname === hrefPath && matchesQuery(hrefQuery)
    }

    // 일반 항목: pathname 기반. 단, 같은 pathname 의 deep link 형제가 활성화면 비활성.
    const deepLinkSiblingActive = allItems.some(other => {
      if (other.href === href) return false
      const [otherPath, otherQuery] = other.href.split('?')
      return otherQuery && otherPath === href && matchesQuery(otherQuery)
    })
    if (deepLinkSiblingActive) return false

    const exactMatch = pathname === href
    const prefixMatch = href !== '/' && pathname.startsWith(href + '/')
    const overridden = !exactMatch && prefixMatch && allItems.some(
      other => other.href !== href && pathname.startsWith(other.href.split('?')[0]) && other.href.split('?')[0].startsWith(href + '/')
    )
    return exactMatch || (prefixMatch && !overridden)
  }

  // subItem: 펼친 상태에서만 들여쓰기 + 보조 (text-xs, 약한 색). 축소 상태는 아이콘 가운데 정렬 유지.
  const navLinkClass = (active: boolean, subItem = false) => {
    const sizing = subItem && !collapsed ? 'text-xs py-2 pl-9' : 'text-sm py-2.5 px-3'
    const colorBase = subItem && !active
      ? 'text-slate-500 hover:text-brand-500 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800'
      : 'text-slate-400 hover:text-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800'
    return `relative flex items-center gap-3 font-medium transition-colors duration-200 ${sizing} ${
      active ? 'text-brand-600 bg-brand-600/5' : colorBase
    } ${collapsed ? 'justify-center px-3' : ''}`
  }

  const renderNavItem = (item: MenuItem, allItems: MenuItem[] = []) => {
    const active = isActive(item.href, allItems)
    const Icon = item.icon
    const subItem = item.subItem === true

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              onClick={onClose}
              className={navLinkClass(active, subItem)}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-600 rounded-r" />}
              <Icon size={17} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={navLinkClass(active, subItem)}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-600 rounded-r" />}
        <Icon size={subItem ? 14 : 17} />
        {item.label}
      </Link>
    )
  }

  return (
    <TooltipProvider>
      <aside className={`${collapsed ? 'w-16' : 'w-60'} h-screen flex flex-col border-r border-border shrink-0 bg-background transition-[width] duration-200`}>
        {/* 로고 */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-6'} py-5 border-b border-border gap-3`}>
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" />
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Agatha</p>
                <p className="text-[10px] text-muted-foreground">Marketing Intelligence</p>
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={togglePin}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      pinned
                        ? 'text-brand-600 hover:bg-brand-600/10'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    aria-label={pinned ? '사이드바 고정 해제' : '사이드바 고정'}
                  >
                    {pinned ? <PinOff size={15} /> : <Pin size={15} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {pinned ? '고정 해제' : '고정'}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* 클라이언트 스위처 */}
        {(isSuperAdmin || isAgencyStaff || isDemoViewer) && (
          <div className={`${collapsed ? 'px-2' : 'px-3'} py-3 border-b border-border`}>
            {collapsed ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label="클라이언트 선택"
                  >
                    <Building2 size={17} />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-56 p-2">
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
                </PopoverContent>
              </Popover>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 px-1">클라이언트 선택</p>
                <Select
                  value={selectedClientId?.toString() ?? 'all'}
                  onValueChange={v => setSelectedClientId(v === 'all' ? null : Number(v))}
                  onOpenChange={onDropdownOpenChange}
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
                  <p className="text-[10px] text-brand-600 mt-1.5 px-1">{selectedClient.name} 데이터 조회 중</p>
                )}
              </>
            )}
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {generalMenuGroups.filter(g => userLevel >= (g.minRole || 1)).map((group, groupIndex) => {
            const visibleItems = group.items
              .filter(item => userLevel >= (item.minRole || 1))
              .filter(filterMenuItem)
            if (visibleItems.length === 0) return null
            return (
              <div key={groupIndex}>
                {groupIndex > 0 && <div className="my-2 mx-2 border-t border-border" />}
                <div className="space-y-0.5">
                  {visibleItems.map(item => renderNavItem(item, visibleItems))}
                </div>
              </div>
            )
          })}

          {/* client_admin 전용: 담당자 관리 */}
          {isClientAdmin && (
            <div className="space-y-0.5 mt-2">
              <div className="my-2 mx-2 border-t border-border" />
              {!collapsed && (
                <div className="pt-2 pb-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3">관리</p>
                </div>
              )}
              {renderNavItem({ href: '/staff', label: '담당자 관리', icon: UserCog })}
            </div>
          )}

          {/* 슈퍼어드민 관리 메뉴 (데모 뷰어는 제외) */}
          {isSuperAdmin && !isDemoViewer && (
            <>
              <div className="my-2 mx-2 border-t border-border" />
              {!collapsed && (
                <div className="pt-2 pb-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3">관리</p>
                </div>
              )}
              <div className="space-y-0.5">
                {adminMenuItems.map(item => renderNavItem(item, adminMenuItems))}
              </div>
            </>
          )}
        </nav>

        {/* 하단: 축소 시 테마 토글 */}
        {collapsed && (
          <div className="px-2 py-2 border-t border-border">
            <ThemeToggle />
          </div>
        )}

        {/* 사용자 메뉴 */}
        <div className={`${collapsed ? 'px-2' : 'px-3'} pb-4 border-t border-border pt-3`}>
          {!collapsed && (
            <div className="flex items-center justify-between mb-2 px-1">
              <ThemeToggle />
            </div>
          )}
          <DropdownMenu onOpenChange={onDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              {collapsed ? (
                <button className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors duration-200 cursor-pointer" aria-label="사용자 메뉴">
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-600 font-semibold text-sm shrink-0">
                    {(user?.name || user?.phone_number)?.[0]?.toUpperCase() || <User size={14} />}
                  </div>
                </button>
              ) : (
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors duration-200 text-left cursor-pointer" aria-label="사용자 메뉴">
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-600 font-semibold text-sm shrink-0">
                    {(user?.name || user?.phone_number)?.[0]?.toUpperCase() || <User size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{user?.name || user?.phone_number}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isDemoViewer ? '데모 체험' : isSuperAdmin ? '슈퍼어드민' : isAgencyStaff ? '에이전시 담당자' : isClientAdmin ? '클라이언트 관리자' : '클라이언트 담당자'}
                    </p>
                  </div>
                  <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuLabel>
                {user?.name || user?.phone_number}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!isDemoViewer && (
                <DropdownMenuItem onClick={() => setPwDialogOpen(true)}>
                  <KeyRound size={14} />
                  비밀번호 변경
                </DropdownMenuItem>
              )}
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
    </TooltipProvider>
  )
}
