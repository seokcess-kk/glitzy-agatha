'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CustomerJourney } from '@/components/common/customer-journey'

interface CustomerJourneySheetProps {
  customer: {
    customerId: number
    name: string
    phone: string
    channel: string
    campaign: string
    firstLeadDate: string
    totalRevenue: number
    payments: any[]
    journey: {
      leads: any[]
      bookings: any[]
      consultations: any[]
      payments: any[]
    }
  } | null
  open: boolean
  onClose: () => void
}

const maskName = (name: string | null) => {
  if (!name || name.length < 2) return name || '-'
  return name[0] + '*' + name.slice(-1)
}

export default function CustomerJourneySheet({ customer, open, onClose }: CustomerJourneySheetProps) {
  if (!customer) return null

  const { journey } = customer

  // payments를 CustomerJourney 형식에 맞게 변환
  const paymentsForJourney = customer.payments.map(p => ({
    id: p.id,
    payment_amount: p.amount,
    payment_date: p.date,
    treatment_name: p.treatment,
    created_at: p.date,
  }))

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg">고객 여정 상세</SheetTitle>
        </SheetHeader>

        {/* 고객 요약 */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">고객명</span>
            <span className="text-sm font-medium text-foreground">{maskName(customer.name)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">유입 채널</span>
            <span className="text-sm text-foreground">{customer.channel}</span>
          </div>
          {customer.campaign && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">캠페인</span>
              <span className="text-sm text-brand-400">{customer.campaign}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">총 결제액</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₩{customer.totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t border-border dark:border-white/5 pt-4">
          <CustomerJourney
            leads={journey.leads || []}
            bookings={journey.bookings || []}
            consultations={journey.consultations || []}
            payments={paymentsForJourney}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
