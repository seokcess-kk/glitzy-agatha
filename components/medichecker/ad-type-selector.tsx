'use client'
import { Button } from '@/components/ui/button'
import { FileText, Instagram, Youtube, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdType } from '@/lib/medichecker/types'
import { AD_TYPE_LABELS } from '@/lib/medichecker/types'

interface AdTypeSelectorProps {
  value: AdType
  onChange: (type: AdType) => void
  disabled?: boolean
}

const AD_TYPE_ICONS: Record<AdType, LucideIcon> = {
  blog: FileText,
  instagram: Instagram,
  youtube: Youtube,
  other: MoreHorizontal,
}

const AD_TYPES: AdType[] = ['blog', 'instagram', 'youtube', 'other']

export function AdTypeSelector({ value, onChange, disabled }: AdTypeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground shrink-0">매체 유형</span>
      <div className="flex gap-1.5">
        {AD_TYPES.map((type) => {
          const Icon = AD_TYPE_ICONS[type]
          const isActive = value === type
          return (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'glass'}
              className={isActive ? 'bg-brand-600 hover:bg-brand-700 text-white' : ''}
              onClick={() => onChange(type)}
              disabled={disabled}
              aria-label={AD_TYPE_LABELS[type]}
              aria-pressed={isActive}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{AD_TYPE_LABELS[type]}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
