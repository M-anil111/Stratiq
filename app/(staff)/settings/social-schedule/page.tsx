'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CalendarClock, Clock, Plus, X, Check, Loader2, Sparkles, Globe, AlertCircle,
} from 'lucide-react'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = (typeof DAYS)[number]

const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}
const DAY_SHORT: Record<Day, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

type Schedule = {
  times: Record<Day, string[]>
  publishLikeAHuman: boolean
}

function emptyTimes(): Record<Day, string[]> {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
}
function defaultSchedule(): Schedule {
  return { times: emptyTimes(), publishLikeAHuman: false }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// 12h display for a "HH:MM" 24h string.
function fmt(t: string): string {
  const [hStr, m] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${period}`
}

function sortTimes(arr: string[]): string[] {
  return [...arr].sort()
}

export default function SocialSchedulePage() {
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add-time popover state
  const [addFor, setAddFor] = useState<Day | null>(null)
  const [newTime, setNewTime] = useState('09:00')
  const [mirrorDays, setMirrorDays] = useState<Set<Day>>(new Set())

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLoad = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/settings/social-schedule')
        const json = await res.json()
        if (!cancelled && json?.schedule) {
          const s = json.schedule as Schedule
          setSchedule({
            times: { ...emptyTimes(), ...s.times },
            publishLikeAHuman: !!s.publishLikeAHuman,
          })
        }
      } catch {
        if (!cancelled) setError('Could not load your schedule.')
      } finally {
        if (!cancelled) {
          setLoading(false)
          didLoad.current = true
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const persist = useCallback(async (next: Schedule) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/settings/social-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: next }),
      })
      if (!res.ok) {
        if (res.status === 403) throw new Error('You need manager or admin access to change the schedule.')
        throw new Error('Save failed.')
      }
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }, [])

  // Autosave whenever the schedule changes (after initial load).
  useEffect(() => {
    if (!didLoad.current) return
    const t = setTimeout(() => { persist(schedule) }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule])

  const removeTime = (day: Day, time: string) => {
    setSchedule(prev => ({
      ...prev,
      times: { ...prev.times, [day]: prev.times[day].filter(t => t !== time) },
    }))
  }

  const openAdd = (day: Day) => {
    setAddFor(day)
    setNewTime('09:00')
    setMirrorDays(new Set())
  }

  const confirmAdd = () => {
    if (!addFor || !TIME_RE.test(newTime)) return
    const targetDays: Day[] = [addFor, ...DAYS.filter(d => d !== addFor && mirrorDays.has(d))]
    setSchedule(prev => {
      const times = { ...prev.times }
      targetDays.forEach((d: Day) => {
        if (!times[d].includes(newTime)) {
          times[d] = sortTimes([...times[d], newTime])
        }
      })
      return { ...prev, times }
    })
    setAddFor(null)
  }

  const toggleHuman = () => {
    setSchedule(prev => ({ ...prev, publishLikeAHuman: !prev.publishLikeAHuman }))
  }

  const toggleMirror = (day: Day) => {
    setMirrorDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="h-8 w-56 rounded-lg bg-white/[0.06] animate-pulse mb-6" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="h-4 w-16 rounded bg-white/[0.08] animate-pulse" />
              <div className="h-7 w-24 rounded-full bg-white/[0.05] animate-pulse" />
              <div className="h-7 w-20 rounded-full bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-sky-400" /> Publishing Schedule
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Set the preferred times to publish social posts each week. New posts snap to the next open slot.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 h-8">
          {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>)
            : saved ? (<><Check className="h-3.5 w-3.5 text-emerald-400" /> Saved</>)
              : null}
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-rose-300 border border-rose-500/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Time zone reminder */}
      <div className="glass-card rounded-xl p-3 mb-4 flex items-start gap-2.5 text-sm text-slate-300">
        <Globe className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          Times use your organization&apos;s time zone. Make sure it&apos;s correct in{' '}
          <span className="text-slate-100 font-medium">Company settings</span> so posts publish when you expect.
        </span>
      </div>

      {/* Publish like a human toggle */}
      <div className="glass-card rounded-2xl p-4 mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="min-w-0">
            <div className="text-white font-medium">Publish like a human</div>
            <p className="text-slate-400 text-sm mt-0.5">
              Posts publish within ±10 minutes of the scheduled time so your account looks natural rather than automated.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={schedule.publishLikeAHuman}
          onClick={toggleHuman}
          className={`relative shrink-0 h-6 w-11 rounded-full transition-colors ${
            schedule.publishLikeAHuman ? 'bg-sky-500' : 'bg-white/[0.12]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              schedule.publishLikeAHuman ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Weekly grid */}
      <div className="space-y-3">
        {DAYS.map(day => (
          <div key={day} className="glass-card rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-white font-medium text-sm sm:w-24 shrink-0">
                {DAY_LABELS[day]}
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {schedule.times[day].length === 0 && (
                  <span className="text-slate-500 text-sm">No times set</span>
                )}
                {schedule.times[day].map(time => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] pl-2.5 pr-1 py-1 text-sm text-slate-100"
                  >
                    <Clock className="h-3 w-3 text-slate-400" />
                    {fmt(time)}
                    <button
                      type="button"
                      onClick={() => removeTime(day, time)}
                      aria-label={`Remove ${fmt(time)} on ${DAY_LABELS[day]}`}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => openAdd(day)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/[0.15] px-2.5 py-1 text-sm text-slate-300 hover:text-white hover:border-white/[0.3] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add time
                </button>
              </div>
            </div>

            {/* Add-time picker */}
            {addFor === day && (
              <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm text-slate-300">Publish at</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="input-glass rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">Also add this time to:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.filter(d => d !== day).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleMirror(d)}
                        aria-pressed={mirrorDays.has(d)}
                        className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                          mirrorDays.has(d)
                            ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                            : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white'
                        }`}
                      >
                        {DAY_SHORT[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmAdd}
                    disabled={!TIME_RE.test(newTime)}
                    className="btn-brand rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddFor(null)}
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
