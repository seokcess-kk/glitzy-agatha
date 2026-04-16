'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/card'
import QuoteList from '@/components/erp-documents/quote-list'
import InvoiceList from '@/components/erp-documents/invoice-list'

const TABS = [
  { key: 'quotes', label: '견적서' },
  { key: 'invoices', label: '계산서' },
]

export default function ErpDocumentsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as { role?: string } | undefined

  // Role guard — clinic_staff cannot access
  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  const { selectedClinicId } = useClinic()
  const [activeTab, setActiveTab] = useState('quotes')

  // Restore tab from URL on mount
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'invoices') setActiveTab(tab)
  }, [])

  // Sync tab selection to URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'quotes') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    window.history.replaceState({}, '', url.toString())
  }

  if (user?.role === 'clinic_staff') return null

  return (
    <>
      <PageHeader
        title="견적/계산서"
        icon={Receipt}
        description="glitzy-web ERP 문서 조회"
      />

      {!selectedClinicId ? (
        <Card variant="glass" className="p-4 md:p-5">
          <p className="text-sm text-muted-foreground text-center py-8">
            병원을 선택해주세요
          </p>
        </Card>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-border dark:border-white/5 pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'quotes' && <QuoteList clinicId={selectedClinicId} />}
          {activeTab === 'invoices' && <InvoiceList clinicId={selectedClinicId} />}
        </>
      )}
    </>
  )
}
