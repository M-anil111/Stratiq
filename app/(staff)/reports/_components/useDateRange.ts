'use client'
import { useMemo, useState } from 'react'

export type RangePreset = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom'

export interface DateRangeState {
  preset: RangePreset
  setPreset: (p: RangePreset) => void
  customStart: string
  customEnd: string
  setCustomStart: (v: string) => void
  setCustomEnd: (v: string) => void
  compare: boolean
  setCompare: (v: boolean) => void
  /** Resolved YYYY-MM-DD range (inclusive). */
  start: string
  end: string
  /** Previous period of equal length (only meaningful when compare is on). */
  compareStart: string
  compareEnd: string
  rangeLabel: string
  compareLabel: string
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000)

function resolvePreset(preset: RangePreset, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date()
  const today = iso(now)
  switch (preset) {
    case '7d': return { start: iso(addDays(now, -6)), end: today }
    case '30d': return { start: iso(addDays(now, -29)), end: today }
    case '90d': return { start: iso(addDays(now, -89)), end: today }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: iso(s), end: today }
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: iso(s), end: iso(e) }
    }
    case 'custom':
      return { start: customStart || iso(addDays(now, -29)), end: customEnd || today }
  }
}

const fmt = (d: string) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00Z')
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function useDateRange(initial: RangePreset = '30d'): DateRangeState {
  const [preset, setPreset] = useState<RangePreset>(initial)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [compare, setCompare] = useState(false)

  const { start, end } = useMemo(() => resolvePreset(preset, customStart, customEnd), [preset, customStart, customEnd])

  const { compareStart, compareEnd } = useMemo(() => {
    if (!start || !end) return { compareStart: '', compareEnd: '' }
    const len = Math.max(0, daysBetween(start, end)) + 1
    const cEnd = iso(addDays(new Date(start + 'T00:00:00Z'), -1))
    const cStart = iso(addDays(new Date(start + 'T00:00:00Z'), -len))
    return { compareStart: cStart, compareEnd: cEnd }
  }, [start, end])

  return {
    preset, setPreset, customStart, customEnd, setCustomStart, setCustomEnd,
    compare, setCompare,
    start, end, compareStart, compareEnd,
    rangeLabel: `${fmt(start)} – ${fmt(end)}`,
    compareLabel: `${fmt(compareStart)} – ${fmt(compareEnd)}`,
  }
}

export const PRESET_LABELS: Record<RangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom',
}

/** Percentage delta helper for compare tiles. Returns null when not comparable. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous == null || current == null || !isFinite(previous) || previous === 0) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  if (!isFinite(pct)) return null
  return pct
}
