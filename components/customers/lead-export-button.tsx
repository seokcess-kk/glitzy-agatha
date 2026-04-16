'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useClient } from '@/components/ClientContext'

interface LeadExportButtonProps {
  filters: {
    status?: string
    utm_source?: string
    date_from?: string
    date_to?: string
    campaign?: string
  }
}

export function LeadExportButton({ filters }: LeadExportButtonProps) {
  const { selectedClientId } = useClient()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (selectedClientId) params.set('client_id', String(selectedClientId))
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.utm_source && filters.utm_source !== 'all') params.set('utm_source', filters.utm_source)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)
      if (filters.campaign && filters.campaign !== 'all') params.set('campaign', filters.campaign)

      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/customers/leads/export${qs}`)
      if (!res.ok) throw new Error('내보내기에 실패했습니다.')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'leads_export.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV 내보내기 완료')
    } catch (e: any) {
      toast.error(e.message || '내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="text-xs"
    >
      <Download size={13} className="mr-1" />
      {exporting ? '내보내는 중...' : 'CSV 내보내기'}
    </Button>
  )
}
