'use client'

import { useMemo } from 'react'
import {
  MousePointerClick,
  CalendarCheck,
  Users,
  CreditCard,
  Tag,
} from 'lucide-react'
import { ChannelBadge } from './channel-badge'
import { StatusBadge } from './status-badge'
import { getUtmMediumLabel } from '@/lib/utm'

// 여정 이벤트 타입
type JourneyEventType = 'inflow' | 'booking' | 'consultation' | 'payment'

interface JourneyEvent {
  id: string
  type: JourneyEventType
  date: string
  status?: string
  data: {
    // inflow
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    leadIndex?: number
    totalLeads?: number
    // booking
    booking_datetime?: string
    notes?: string
    // consultation
    consultation_date?: string
    consultant_notes?: string
    // payment
    treatment_name?: string
    payment_amount?: number
  }
}

// 이벤트 유형별 설정
const EVENT_CONFIG: Record<JourneyEventType, {
  label: string
  icon: typeof MousePointerClick
}> = {
  inflow: { label: '광고 유입', icon: MousePointerClick },
  booking: { label: '예약', icon: CalendarCheck },
  consultation: { label: '상담', icon: Users },
  payment: { label: '결제', icon: CreditCard },
}

// 이벤트별 색상 결정
function getEventColor(event: JourneyEvent): string {
  switch (event.type) {
    case 'inflow':
      return 'bg-brand-500'
    case 'booking':
      if (event.status === 'cancelled') return 'bg-slate-400 dark:bg-slate-600'
      if (event.status === 'confirmed') return 'bg-blue-500'
      if (event.status === 'visited' || event.status === 'treatment_confirmed') return 'bg-purple-500'
      if (event.status === 'noshow') return 'bg-red-500'
      return 'bg-amber-500'
    case 'consultation':
      return 'bg-purple-500'
    case 'payment':
      return 'bg-emerald-400'
    default:
      return 'bg-slate-400 dark:bg-slate-500'
  }
}

// Supabase timestamp → UTC Date (tz 정보 없으면 UTC로 취급)
function toUtc(dateStr: string): Date {
  const s = dateStr.trim()
  return (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) ? new Date(s) : new Date(s + 'Z')
}

// 날짜 포맷 (null/invalid 안전 처리, KST 기준)
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  const date = toUtc(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })
}

function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  const date = toUtc(dateStr)
  if (isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('ko', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}`
}

// 예약 상태 라벨
const BOOKING_STATUS_LABELS: Record<string, string> = {
  confirmed: '예약확정',
  visited: '방문완료',
  treatment_confirmed: '시술확정',
  noshow: '노쇼',
  cancelled: '취소됨',
}

// 이벤트별 상세 표시
function EventDetail({ event }: { event: JourneyEvent }) {
  switch (event.type) {
    case 'inflow':
      return (
        <div className="mt-1.5 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ChannelBadge channel={event.data.utm_source || 'unknown'} className="text-[10px] px-1.5 py-0.5" />
            {event.data.utm_medium && (
              <span className="text-xs text-muted-foreground">
                {getUtmMediumLabel(event.data.utm_medium)}
              </span>
            )}
          </div>
          {event.data.utm_campaign && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag size={10} className="text-brand-400" />
              <span className="text-brand-400">{event.data.utm_campaign}</span>
            </p>
          )}
          {event.data.utm_content && (
            <p className="text-xs text-muted-foreground/60">
              {event.data.utm_content}
            </p>
          )}
        </div>
      )

    case 'booking': {
      const statusText = BOOKING_STATUS_LABELS[event.status || ''] || event.status || '대기'
      return (
        <div className="mt-1 space-y-1">
          {event.data.booking_datetime && (
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.data.booking_datetime)} 예약
            </p>
          )}
          <StatusBadge status={statusText} className="text-[10px]" />
          {event.data.notes && (
            <p className="text-xs text-muted-foreground/60 mt-1">{event.data.notes}</p>
          )}
        </div>
      )
    }

    case 'consultation':
      return (
        <div className="mt-1">
          <p className="text-xs text-muted-foreground">
            {event.status || '상담 진행'}
          </p>
          {event.data.consultant_notes && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.data.consultant_notes}</p>
          )}
        </div>
      )

    case 'payment':
      return (
        <div className="mt-1">
          {event.data.treatment_name && (
            <p className="text-xs text-muted-foreground">{event.data.treatment_name}</p>
          )}
          {event.data.payment_amount != null && (
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              ₩{event.data.payment_amount.toLocaleString()}
            </p>
          )}
        </div>
      )

    default:
      return null
  }
}

// 단일 이벤트 아이템
function JourneyEventItem({ event, isLast }: { event: JourneyEvent; isLast: boolean }) {
  const config = EVENT_CONFIG[event.type]
  const Icon = config.icon
  const color = getEventColor(event)
  const isCancelled = event.type === 'booking' && event.status === 'cancelled'

  // 라벨 생성
  let label = config.label
  if (event.type === 'inflow' && event.data.totalLeads && event.data.totalLeads > 1) {
    label = `${config.label} #${event.data.leadIndex}`
  }

  return (
    <div
      role="listitem"
      aria-label={`${label} - ${formatDate(event.date)}`}
      className={`relative flex gap-3 ${isCancelled ? 'opacity-50' : ''}`}
    >
      {/* 연결선 (마지막 제외) */}
      {!isLast && (
        <div className="absolute left-[7px] top-5 bottom-0 w-0.5 bg-border dark:bg-white/10" aria-hidden="true" />
      )}

      {/* 도트 + 아이콘 */}
      <div
        className={`relative z-10 w-4 h-4 rounded-full ${color} flex items-center justify-center shrink-0 mt-0.5`}
        aria-hidden="true"
      >
        <Icon size={10} className="text-white" />
      </div>

      {/* 내용 */}
      <div className="flex-1 pb-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground/80">{label}</p>
          <span className="text-xs text-muted-foreground/60 shrink-0">
            {formatDate(event.date)}
          </span>
        </div>
        <EventDetail event={event} />
      </div>
    </div>
  )
}

// 여정 이벤트 빌드
function buildJourneyEvents(
  leads: any[],
  bookings: any[],
  consultations: any[],
  payments: any[]
): JourneyEvent[] {
  const events: JourneyEvent[] = []
  const totalLeads = leads.length

  // 유입 이벤트
  leads.forEach((l, idx) => {
    events.push({
      id: `inflow-${l.id}`,
      type: 'inflow',
      date: l.created_at,
      data: {
        utm_source: l.utm_source,
        utm_medium: l.utm_medium,
        utm_campaign: l.utm_campaign,
        utm_content: l.utm_content,
        leadIndex: idx + 1,
        totalLeads,
      },
    })
  })

  // 예약 이벤트
  bookings.forEach((b) => {
    events.push({
      id: `booking-${b.id}`,
      type: 'booking',
      date: b.created_at,
      status: b.status,
      data: {
        booking_datetime: b.booking_datetime,
        notes: b.notes,
      },
    })
  })

  // 상담 이벤트
  consultations.forEach((c) => {
    events.push({
      id: `consultation-${c.id}`,
      type: 'consultation',
      date: c.created_at || c.consultation_date,
      status: c.status,
      data: {
        consultation_date: c.consultation_date,
        consultant_notes: c.notes,
      },
    })
  })

  // 결제 이벤트
  payments.forEach((p) => {
    events.push({
      id: `payment-${p.id}`,
      type: 'payment',
      date: p.payment_date || p.created_at,
      data: {
        treatment_name: p.treatment_name,
        payment_amount: Number(p.payment_amount),
      },
    })
  })

  // 시간순 정렬 (오래된 것 먼저, 동일 시간이면 타입 순서 유지)
  const typeOrder: Record<JourneyEventType, number> = {
    inflow: 0,
    booking: 1,
    consultation: 2,
    payment: 3,
  }
  return events.sort((a, b) => {
    const toTs = (s: string) => { const t = s.trim(); return (t.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(t)) ? new Date(t).getTime() : new Date(t + 'Z').getTime() }
    const timeDiff = toTs(a.date) - toTs(b.date)
    if (timeDiff !== 0) return timeDiff
    // 동일 시간: inflow → booking → consultation → payment 순서 보장
    return typeOrder[a.type] - typeOrder[b.type]
  })
}

// Props 타입
interface CustomerJourneyProps {
  leads: any[]
  bookings: any[]
  consultations: any[]
  payments: any[]
  className?: string
}

// 메인 컴포넌트
export function CustomerJourney({
  leads,
  bookings,
  consultations,
  payments,
  className = '',
}: CustomerJourneyProps) {
  const events = useMemo(
    () => buildJourneyEvents(leads, bookings, consultations, payments),
    [leads, bookings, consultations, payments]
  )

  if (events.length === 0) {
    return (
      <div className={`text-center py-6 text-muted-foreground text-sm ${className}`}>
        여정 이벤트가 없습니다.
      </div>
    )
  }

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-muted-foreground mb-4 flex items-center gap-2">
        <MousePointerClick size={12} aria-hidden="true" /> 여정 타임라인
      </p>
      <div className="pl-1" role="list" aria-label="고객 여정 타임라인">
        {events.map((event, idx) => (
          <JourneyEventItem
            key={event.id}
            event={event}
            isLast={idx === events.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
