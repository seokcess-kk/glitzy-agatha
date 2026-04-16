'use client'

import { ArrowUpDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SortOption {
  value: string
  label: string
}

interface SortSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SortOption[]
  className?: string
}

export function SortSelect({ value, onValueChange, options, className }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`w-auto min-w-[110px] h-9 bg-card border-border dark:border-white/10 text-xs ${className || ''}`}>
        <ArrowUpDown size={11} className="mr-1 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
