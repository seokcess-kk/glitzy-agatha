'use client'

import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import { Monitor, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DemoBanner() {
  const { data: session } = useSession()
  const isDemoViewer = session?.user?.role === 'demo_viewer'

  if (!isDemoViewer) return null

  return (
    <div className="bg-brand-50 dark:bg-brand-950 border-b border-brand-200 dark:border-brand-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-300">
          <Monitor size={16} />
          <span className="font-medium">데모 모드</span>
          <span className="text-brand-500 dark:text-brand-400">| 샘플 데이터로 체험 중입니다. 데이터 수정은 불가합니다.</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-brand-600 hover:text-brand-800 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-900 h-7 text-xs"
        >
          <LogOut size={14} className="mr-1" />
          데모 종료
        </Button>
      </div>
    </div>
  )
}
