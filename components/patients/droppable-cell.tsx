'use client'

import { useDroppable } from '@dnd-kit/core'

interface DroppableCellProps {
  id: string
  dateKey: string
  hour?: number
  minute?: number
  children: React.ReactNode
  className?: string
  onClick?: () => void
  asDiv?: boolean
}

export function DroppableCell({ id, dateKey, hour, minute, children, className, onClick }: DroppableCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { dateKey, hour, minute },
  })

  const overClass = isOver
    ? 'ring-2 ring-brand-500/60 bg-brand-500/10 dark:bg-brand-500/15 scale-[1.02] shadow-sm'
    : ''
  const combinedClass = `${className || ''} ${overClass} transition-all duration-200`

  return (
    <div ref={setNodeRef} onClick={onClick} className={combinedClass}>
      {children}
    </div>
  )
}
