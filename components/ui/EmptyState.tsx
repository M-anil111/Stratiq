import type { LucideIcon } from 'lucide-react'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  /** Use 'sm' for tight spaces like a kanban column or a card sidebar. Defaults to 'md'. */
  size?: 'sm' | 'md'
  className?: string
}

export default function EmptyState({ icon: Icon, title, description, action, size = 'md', className = '' }: EmptyStateProps) {
  const isSm = size === 'sm'

  return (
    <div className={`${isSm ? 'p-4' : 'p-10'} text-center text-slate-600 dark:text-slate-400 ${className}`}>
      <div className={`mx-auto ${isSm ? 'mb-2 h-8 w-8' : 'mb-3 h-11 w-11'} rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] flex items-center justify-center`}>
        <Icon className={`${isSm ? 'h-4 w-4' : 'h-5 w-5'} opacity-50`} />
      </div>
      <p className={`font-medium text-slate-700 dark:text-slate-300 ${isSm ? 'text-xs' : 'mb-1'}`}>{title}</p>
      {description && <p className={`${isSm ? 'text-xs' : 'text-sm'} max-w-sm mx-auto`}>{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-brand inline-flex items-center gap-2 mt-4">
          {action.label}
        </button>
      )}
    </div>
  )
}
