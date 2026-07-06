'use client'
import { createContext, useContext, useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'stratiq-theme'

type ThemeContextValue = {
  /** The user's stored preference. */
  theme: ThemePreference
  /** The concrete theme currently applied to the document. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? systemTheme() : pref
}

function apply(pref: ThemePreference) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolve(pref))
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')

  // Hydrate from localStorage (set pre-hydration by the inline script) then
  // sync the server preference on top of it if available.
  useEffect(() => {
    let stored: ThemePreference | null = null
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'light' || v === 'dark' || v === 'system') stored = v
    } catch {}
    const initial = stored ?? 'dark'
    setThemeState(initial)
    setResolvedTheme(resolve(initial))
    apply(initial)

    // Pull server preference; only overrides if the user hasn't chosen locally.
    fetch('/api/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const server = data?.theme_preference as ThemePreference | undefined
        if ((server === 'light' || server === 'dark' || server === 'system') && !stored) {
          setThemeState(server)
          setResolvedTheme(resolve(server))
          apply(server)
          try { localStorage.setItem(STORAGE_KEY, server) } catch {}
        }
      })
      .catch(() => {})
  }, [])

  // Track OS changes while in 'system' mode.
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      setResolvedTheme(systemTheme())
      apply('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    setResolvedTheme(resolve(next))
    apply(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    // Persist to the server; tolerate failures/missing column silently.
    fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_preference: next }),
    }).catch(() => {})
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
