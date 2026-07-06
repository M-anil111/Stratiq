'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Globe, Sparkles, X } from 'lucide-react'

// A nicer "Schedule for later" control: a popover with a mini month calendar,
// a Posting Slots section (org's saved times for the chosen weekday), a manual
// time input, and the account timezone label. Emits a `datetime-local` string
// (YYYY-MM-DDTHH:MM) via onChange so the composer/review flow reads it unchanged.

// getDay() → 0=Sun; saved-times keys are mon..sun.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const pad = (n: number) => String(n).padStart(2, '0')
function toValue(d: Date, hh: number, mm: number) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Shape returned by /api/social/recommended-times.
type RecRange = { start: string; end: string; score: number }
type RecDay = { day: number; ranges: RecRange[] }

export default function SchedulePicker({
  value,
  onChange,
  savedTimes,
  timezone,
  platform,
}: {
  value: string
  onChange: (val: string) => void
  savedTimes: Record<string, string[]>
  timezone?: string
  platform?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Recommended times (org history or industry defaults), lazy-loaded on open.
  const [recommended, setRecommended] = useState<RecDay[] | null>(null)
  const [recSource, setRecSource] = useState<'history' | 'industry' | null>(null)
  useEffect(() => {
    if (!open || recommended) return
    const qs = platform ? `?platform=${encodeURIComponent(platform)}` : ''
    fetch(`/api/social/recommended-times${qs}`)
      .then(r => r.json())
      .then((d) => {
        if (Array.isArray(d?.recommended)) {
          setRecommended(d.recommended)
          setRecSource(d.source === 'history' ? 'history' : 'industry')
        }
      })
      .catch(() => {})
  }, [open, recommended, platform])

  const selected = useMemo(() => {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }, [value])

  // Which month the calendar is showing.
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // The day the user has picked (defaults to selected day, else today).
  const [pickedDay, setPickedDay] = useState<Date>(() => {
    const base = selected || new Date()
    return new Date(base.getFullYear(), base.getMonth(), base.getDate())
  })
  const [manualTime, setManualTime] = useState(() => (selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : ''))

  // When the popover opens, sync internal view to the current value.
  useEffect(() => {
    if (!open) return
    const base = selected || new Date()
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setPickedDay(new Date(base.getFullYear(), base.getMonth(), base.getDate()))
    if (selected) setManualTime(`${pad(selected.getHours())}:${pad(selected.getMinutes())}`)
  }, [open]) // eslint-disable-line

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const today = new Date()
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const startOffset = monthStart.getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))

  const slotsForDay = savedTimes[DAY_KEYS[pickedDay.getDay()]] || []
  const recForDay = (recommended?.find(r => r.day === pickedDay.getDay())?.ranges) || []

  function commit(hh: number, mm: number) {
    onChange(toValue(pickedDay, hh, mm))
    setOpen(false)
  }
  function pickSlot(t: string) {
    const [hh, mm] = t.split(':').map(Number)
    setManualTime(t)
    commit(hh, mm)
  }
  function applyManual() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(manualTime)) return
    const [hh, mm] = manualTime.split(':').map(Number)
    commit(hh, mm)
  }

  const tzLabel = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-left text-white rounded-xl px-3 py-2.5 text-sm hover:border-white/25 transition-colors"
      >
        <CalendarClock className="h-4 w-4 text-sky-400 shrink-0" />
        <span className={selected ? 'text-white' : 'text-slate-500'}>
          {selected ? selected.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Pick a date & time…'}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear scheduled time"
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange('') } }}
            className="ml-auto text-slate-400 hover:text-white shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] max-w-sm rounded-2xl border border-white/[0.12] bg-[#0f1729] shadow-2xl p-4 space-y-4">
          {/* Month calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button type="button" aria-label="Previous month" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-white">{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
              <button type="button" aria-label="Next month" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((w, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-slate-500">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const isToday = sameDay(d, today)
                const isPicked = sameDay(d, pickedDay)
                const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isPast}
                    onClick={() => setPickedDay(d)}
                    className={`h-8 rounded-lg text-xs transition-colors ${
                      isPicked ? 'bg-sky-500 text-white font-semibold'
                        : isPast ? 'text-slate-600 cursor-not-allowed'
                        : isToday ? 'text-sky-300 ring-1 ring-sky-500/50 hover:bg-white/[0.08]'
                        : 'text-slate-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Posting slots */}
          <div>
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Posting slots</p>
            {slotsForDay.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {slotsForDay.map(t => {
                  const active = manualTime === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => pickSlot(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${active ? 'bg-sky-500 text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-sky-500/20 hover:text-sky-300'}`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No saved slots for this day. Use a custom time below.</p>
            )}
          </div>

          {/* Recommended times — distinct from saved Posting Slots (amber accent) */}
          {recForDay.length > 0 && (
            <div>
              <p className="text-xs text-amber-300/90 mb-1 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Recommended times</p>
              <p className="text-[10px] text-slate-500 mb-2">{recSource === 'history' ? 'Based on your posting history' : 'Based on industry standards'}</p>
              <div className="flex flex-wrap gap-1.5">
                {recForDay.map((r) => {
                  const active = manualTime === r.start
                  return (
                    <button
                      key={r.start}
                      type="button"
                      onClick={() => pickSlot(r.start)}
                      title={`Recommended ${r.start}–${r.end}`}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${active
                        ? 'bg-amber-400/90 text-slate-900 border-amber-300 font-semibold'
                        : 'bg-amber-400/10 text-amber-200 border-amber-400/30 hover:bg-amber-400/20'}`}
                    >
                      {r.start}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Manual time */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Select time</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={manualTime}
                onChange={e => setManualTime(e.target.value)}
                className="flex-1 bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              <button
                type="button"
                onClick={applyManual}
                disabled={!/^([01]\d|2[0-3]):[0-5]\d$/.test(manualTime)}
                className="btn-brand px-3 py-2 text-sm disabled:opacity-50"
              >
                Set
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-white/[0.08] pt-3">
            <Globe className="h-3.5 w-3.5" /> {tzLabel}
          </div>
        </div>
      )}
    </div>
  )
}
