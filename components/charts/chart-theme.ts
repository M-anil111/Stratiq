'use client'
import { useEffect, useState } from 'react'

// A small, theme-aware palette that reads legibly on both light and dark
// surfaces. recharts needs explicit colors, so we derive them here and expose
// a hook that re-renders on theme changes (the app toggles data-theme on <html>).

export interface ChartTheme {
  isDark: boolean
  /** Categorical series palette (works on both themes). */
  palette: string[]
  /** Axis / tick text color. */
  axis: string
  /** Faint grid line color. */
  grid: string
  /** Tooltip surface. */
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

// Brand-aligned categorical palette. Ordered for maximum adjacent contrast.
export const CHART_PALETTE = [
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#84cc16', // lime
  '#06b6d4', // cyan
]

function readIsDark(): boolean {
  if (typeof document === 'undefined') return true
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light') return false
  if (attr === 'dark') return true
  // No explicit attribute — default to dark (app default) but respect OS.
  return !window.matchMedia?.('(prefers-color-scheme: light)').matches
}

/**
 * Returns a theme object for recharts. Re-computes when the root data-theme
 * attribute changes so charts stay in sync with the app's light/dark toggle.
 */
export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = useState<boolean>(true)

  useEffect(() => {
    setIsDark(readIsDark())
    if (typeof document === 'undefined') return
    const obs = new MutationObserver(() => setIsDark(readIsDark()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return {
    isDark,
    palette: CHART_PALETTE,
    axis: isDark ? 'rgba(226,232,240,0.65)' : 'rgba(51,65,85,0.75)',
    grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    tooltipBg: isDark ? 'rgba(10,22,40,0.96)' : 'rgba(255,255,255,0.98)',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
    tooltipText: isDark ? '#e2e8f0' : '#0f172a',
  }
}

export function colorAt(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]
}
