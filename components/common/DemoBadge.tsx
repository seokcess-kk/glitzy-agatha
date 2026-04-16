'use client'

import { useSession } from 'next-auth/react'

/**
 * Demo 모드 배지 — demo_viewer 세션일 때만 표시.
 * 촬영 시 숨기려면: document.querySelector('[data-demo-badge]')?.remove()
 * 또는 console에서 `document.querySelector('[data-demo-badge]').style.display='none'`
 */
export default function DemoBadge() {
  const { data } = useSession()
  if (data?.user?.role !== 'demo_viewer') return null

  return (
    <div
      data-demo-badge
      className="fixed top-4 right-4 z-[100] pointer-events-none select-none"
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 text-black text-xs font-semibold shadow-lg backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-black/70 animate-pulse" />
        DEMO MODE
      </div>
    </div>
  )
}
