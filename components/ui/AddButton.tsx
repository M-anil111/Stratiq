'use client'
import { Plus } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface AddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  size?: 'sm' | 'md'
  icon?: ReactNode
}

/**
 * Polished primary "add / create" action button.
 * Self-contained so any page can adopt it. Consistent with the
 * brand gradient (see `.btn-brand` in globals.css) with a proper
 * focus ring, hover lift and size variants.
 */
export default function AddButton({
  label = 'Add',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}: AddButtonProps) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  }
  const iconSize = size === 'sm' ? 14 : 16

  return (
    <button
      {...props}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-semibold text-white
        bg-gradient-to-br from-sky-500 to-sky-600
        hover:from-sky-400 hover:to-sky-500
        shadow-[0_4px_16px_rgba(14,165,233,0.45),0_0_0_1px_rgba(14,165,233,0.3)]
        hover:shadow-[0_6px_24px_rgba(14,165,233,0.55),0_0_0_1px_rgba(14,165,233,0.4)]
        hover:-translate-y-px active:translate-y-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
        disabled:opacity-50 disabled:pointer-events-none
        transition-all duration-200 ease-out
        ${sizes[size]} ${className}
      `}
    >
      {icon ?? <Plus size={iconSize} className="shrink-0" />}
      {label}
    </button>
  )
}
