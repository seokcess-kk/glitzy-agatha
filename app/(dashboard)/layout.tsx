'use client'
import { useState, useEffect, useCallback } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { ClientProvider } from '@/components/ClientContext'
import { WebVitals } from '@/components/common'

const PINNED_KEY = 'agatha_sidebar_pinned'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)

  const expanded = pinned || hovered

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PINNED_KEY)
      if (saved === 'true') setPinned(true)
    } catch {}
  }, [])

  const togglePin = useCallback(() => {
    setPinned(prev => {
      const next = !prev
      try { localStorage.setItem(PINNED_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  return (
    <ClientProvider>
      <WebVitals />
      <div className="flex h-screen overflow-hidden relative bg-background">

        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-300 ease-in-out"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 사이드바 — 모바일: 슬라이드인, 데스크탑: hover 확대 + 핀 고정 */}
        {/* 축소 시 플레이스홀더: 항상 w-16 공간 확보 */}
        <div className="hidden md:block w-16 shrink-0" />
        <div
          className={`
            ${expanded ? 'w-60' : 'w-16'} shrink-0 fixed inset-y-0 left-0 z-50 md:z-30
            transition-all duration-200 ease-in-out
            md:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <Sidebar
            onClose={() => setSidebarOpen(false)}
            collapsed={!expanded}
            pinned={pinned}
            onTogglePin={togglePin}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
          {/* 모바일 상단 바 */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-background">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              aria-label="메뉴 열기"
            >
              <Menu size={20} />
            </button>
            <p className="text-sm font-bold text-foreground">Agatha</p>
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>

      </div>
    </ClientProvider>
  )
}
