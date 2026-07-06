'use client'
import { useEffect, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Right-anchored slide-over drawer (HubSpot-style).
 * Slides in from the right with a dimmed backdrop. Closes on backdrop click
 * and Esc, traps focus within the panel, and respects prefers-reduced-motion.
 */
export default function SlideOver({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'w-[480px]',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Focus the panel on open + lock body scroll
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelector<HTMLElement>(
        'input, textarea, select, button:not([disabled]), a[href]'
      )
      focusable?.focus()
    }, 50)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-300"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute right-0 top-0 h-full ${widthClass} max-w-[90vw] flex flex-col bg-white dark:bg-[#0f1e35] border-l border-slate-900/10 dark:border-white/[0.08] shadow-2xl motion-safe:animate-[slideOverIn_0.28s_cubic-bezier(0.32,0.72,0,1)]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-900/10 dark:border-white/[0.08] shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-slate-900/10 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02]">
            {footer}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideOverIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
