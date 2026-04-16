'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { ClinicProvider } from '@/components/ClinicContext'
import { WebVitals, DemoBadge } from '@/components/common'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ClinicProvider>
      <WebVitals />
      <DemoBadge />
      <div className="flex h-screen overflow-hidden relative bg-background">

        {/* 배경 다이나믹 글로우 — 다크 모드 전용 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden dark:block">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-brand-600/10 via-brand-600/5 to-transparent rounded-full blur-3xl mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tl from-violet-500/5 via-brand-500/5 to-transparent rounded-full blur-3xl mix-blend-screen" />
        </div>

        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 dark:bg-black/60 md:hidden backdrop-blur-sm transition-opacity duration-300 ease-in-out"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 사이드바 — 모바일: 슬라이드인, 데스크탑: 항상 표시 */}
        <div className={`
          w-60 shrink-0 fixed md:static inset-y-0 left-0 z-50 md:z-30
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
          {/* 모바일 상단 바 */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-background/80 backdrop-blur-md">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              aria-label="메뉴 열기"
            >
              <Menu size={20} />
            </button>
            <p className="text-sm font-bold text-foreground">Samantha</p>
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>

      </div>
    </ClinicProvider>
  )
}
