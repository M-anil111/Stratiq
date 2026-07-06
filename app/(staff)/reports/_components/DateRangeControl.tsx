'use client'
import { CalendarRange, GitCompareArrows } from 'lucide-react'
import { DateRangeState, PRESET_LABELS, RangePreset } from './useDateRange'

const PRESETS: RangePreset[] = ['7d', '30d', '90d', 'this_month', 'last_month', 'custom']

const inputClass = 'bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

/**
 * Google-Analytics style date range control: preset pills + custom From/To and
 * a "compare to previous period" toggle. Drives the shared useDateRange hook.
 */
export default function DateRangeControl({ range, className = '' }: { range: DateRangeState; className?: string }) {
  return (
    <div className={`glass-card p-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="h-4 w-4 text-sky-400 shrink-0" />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => range.setPreset(p)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                range.preset === p
                  ? 'bg-sky-500 text-white border-transparent'
                  : 'border-slate-900/10 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {range.preset === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={range.customStart} onChange={e => range.setCustomStart(e.target.value)} className={inputClass} aria-label="From" />
            <span className="text-slate-500 text-sm">–</span>
            <input type="date" value={range.customEnd} onChange={e => range.setCustomEnd(e.target.value)} className={inputClass} aria-label="To" />
          </div>
        )}

        <button
          onClick={() => range.setCompare(!range.compare)}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            range.compare
              ? 'bg-violet-500/15 text-violet-500 dark:text-violet-300 border-violet-500/30'
              : 'border-slate-900/10 dark:border-white/[0.12] text-slate-600 dark:text-slate-400 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
          }`}
          title="Compare to previous period"
        >
          <GitCompareArrows className="h-3.5 w-3.5" /> Compare
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-500">
        <span>{range.rangeLabel}</span>
        {range.compare && (
          <span className="text-violet-500 dark:text-violet-300">vs {range.compareLabel}</span>
        )}
      </div>
    </div>
  )
}

/** Small delta chip for summary tiles. */
export function DeltaChip({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta == null || delta === 0) return null
  const up = delta > 0
  const good = invert ? !up : up
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}
      title="vs previous period"
    >
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}
