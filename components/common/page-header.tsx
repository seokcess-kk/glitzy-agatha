import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  icon?: LucideIcon
}

export function PageHeader({ title, description, actions, icon: Icon }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-3">
          {Icon && <Icon className="text-brand-400 shrink-0" size={24} />}
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
        </div>
        {description && (
          <p className={`text-sm text-muted-foreground mt-1${Icon ? ' pl-9' : ''}`}>{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
