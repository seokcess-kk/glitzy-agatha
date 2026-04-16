'use client'

import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { formatTime } from '@/lib/date'
import { GripVertical } from 'lucide-react'

interface DraggableBookingProps {
  booking: any
  variant?: 'month' | 'week' | 'day'
  statusConfig: { label: string; variant: 'info' | 'success' | 'default' | 'secondary' | 'destructive' }
}

const NON_DRAGGABLE_STATUSES = ['cancelled', 'noshow']

export function DraggableBooking({ booking, variant = 'month', statusConfig }: DraggableBookingProps) {
  const isDragDisabled = NON_DRAGGABLE_STATUSES.includes(booking.status)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `booking-${booking.id}`,
    data: { booking },
    disabled: isDragDisabled,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined

  if (variant === 'day') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`group flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-lg transition-all duration-200 ${
          isDragging
            ? 'opacity-40 scale-95 ring-2 ring-brand-500/30 ring-dashed bg-brand-500/5'
            : isDragDisabled ? 'bg-muted/50 dark:bg-white/[0.02]' : 'bg-brand-500/10 hover:bg-brand-500/15'
        } ${isDragDisabled ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {!isDragDisabled && (
          <GripVertical size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/70 shrink-0 transition-colors duration-200" />
        )}
        <Badge variant={statusConfig.variant} className="text-[10px] px-1.5 py-0 shrink-0">{statusConfig.label}</Badge>
        <span className={`text-xs font-medium text-foreground truncate ${isDragDisabled ? 'line-through' : ''}`}>{booking.customer?.name}</span>
        <span className={`text-[10px] text-muted-foreground ${isDragDisabled ? 'line-through' : ''}`}>{formatTime(booking.booking_datetime)}</span>
        <span className="text-[10px] text-muted-foreground ml-auto truncate">{booking.customer?.phone_number}</span>
      </div>
    )
  }

  // month / week variant
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`text-[10px] truncate transition-all duration-200 ${
        isDragging
          ? 'opacity-40 scale-95'
          : ''
      } ${isDragDisabled ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <Badge variant={statusConfig.variant} className={`text-[10px] px-1 py-0 ${variant === 'week' ? 'w-full justify-start' : ''} ${isDragDisabled ? 'line-through' : ''}`}>
        {formatTime(booking.booking_datetime)} {booking.customer?.name}
      </Badge>
    </div>
  )
}
