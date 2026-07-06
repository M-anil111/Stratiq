'use client'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, type ThemePreference } from './theme-provider'

/** Compact icon button for the top header — toggles between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
      className={cn(
        'p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] transition-colors',
        className
      )}
    >
      {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Segmented Light / Dark / System selector for settings pages. */
export function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] border border-slate-900/[0.06] dark:border-white/[0.08]">
      {OPTIONS.map(opt => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              active
                ? 'nav-active text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <opt.icon className="h-4 w-4" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
