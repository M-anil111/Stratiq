'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Link2, X } from 'lucide-react'

// Content calendar over org-wide scheduled social posts. Fetches the shared
// /api/social/scheduled feed by visible date range. Pure CSS/SVG — no calendar lib.

type CalPost = {
  id: string
  platform: string
  post_content: string | null
  media_url: string | null
  scheduled_date: string | null
  live_link: string | null
  status: string | null
  project_name: string | null
  client_name: string | null
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  x: { label: 'X', color: '#000000' },
  tiktok: { label: 'TikTok', color: '#000000' },
  youtube: { label: 'YouTube', color: '#FF0000' },
}
function meta(platform: string) {
  return PLATFORM_META[platform?.toLowerCase()] || { label: platform || 'Unknown', color: '#64748b' }
}

type View = 'month' | 'week' | 'day'
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function timeLabel(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Visible [start, end) range for a given anchor + view.
function rangeFor(view: View, anchor: Date): { start: Date; end: Date } {
  if (view === 'day') {
    const s = startOfDay(anchor)
    return { start: s, end: addDays(s, 1) }
  }
  if (view === 'week') {
    const s = addDays(startOfDay(anchor), -anchor.getDay())
    return { start: s, end: addDays(s, 7) }
  }
  // month grid: from the Sunday on/before the 1st, to the Saturday on/after month end
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = addDays(startOfDay(first), -first.getDay())
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const gridEnd = addDays(startOfDay(last), 7 - last.getDay())
  return { start: gridStart, end: gridEnd }
}

function titleFor(view: View, anchor: Date): string {
  if (view === 'month') return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
  if (view === 'day') return anchor.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const { start } = rangeFor('week', anchor)
  const wend = addDays(start, 6)
  const sameMonth = start.getMonth() === wend.getMonth()
  const left = `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()}`
  const right = sameMonth ? `${wend.getDate()}` : `${MONTHS[wend.getMonth()].slice(0, 3)} ${wend.getDate()}`
  return `${left} – ${right}, ${wend.getFullYear()}`
}

function PlatformDot({ platform }: { platform: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta(platform).color }} />
}

function PostChip({ post, onClick }: { post: CalPost; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-left transition-colors"
      title={post.post_content || meta(post.platform).label}
    >
      <PlatformDot platform={post.platform} />
      {post.scheduled_date && <span className="text-[10px] text-slate-400 shrink-0">{timeLabel(post.scheduled_date)}</span>}
      <span className="text-[11px] text-slate-200 truncate">{post.post_content || meta(post.platform).label}</span>
    </button>
  )
}

export default function SocialCalendar() {
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()))
  const [posts, setPosts] = useState<CalPost[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [selected, setSelected] = useState<CalPost | null>(null)
  const reqId = useRef(0)

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor])

  useEffect(() => {
    const id = ++reqId.current
    setPosts(null)
    setUnavailable(false)
    const qs = `start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`
    fetch(`/api/social/scheduled?${qs}`)
      .then(r => r.json())
      .then((d) => {
        if (id !== reqId.current) return
        if (d?.__unavailable) { setUnavailable(true); setPosts([]); return }
        setPosts(Array.isArray(d?.posts) ? d.posts : [])
      })
      .catch(() => { if (id === reqId.current) setPosts([]) })
  }, [range])

  // Group posts by day key (local).
  const byDay = useMemo(() => {
    const m: Record<string, CalPost[]> = {}
    for (const p of posts || []) {
      if (!p.scheduled_date) continue
      const d = new Date(p.scheduled_date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      ;(m[key] = m[key] || []).push(p)
    }
    Object.keys(m).forEach(k => {
      m[k].sort((a: CalPost, b: CalPost) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
    })
    return m
  }, [posts])
  function postsOn(d: Date) { return byDay[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] || [] }

  function navigate(dir: -1 | 0 | 1) {
    if (dir === 0) { setAnchor(startOfDay(new Date())); return }
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1))
    else if (view === 'week') setAnchor(addDays(anchor, dir * 7))
    else setAnchor(addDays(anchor, dir))
  }

  const loading = posts === null
  const today = startOfDay(new Date())

  // Build month grid days.
  const monthDays = useMemo(() => {
    if (view !== 'month') return []
    const days: Date[] = []
    for (let d = new Date(range.start); d < range.end; d = addDays(d, 1)) days.push(new Date(d))
    return days
  }, [view, range])

  const weekDays = useMemo(() => {
    if (view !== 'week') return []
    const days: Date[] = []
    for (let i = 0; i < 7; i++) days.push(addDays(range.start, i))
    return days
  }, [view, range])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} aria-label="Previous" className="p-2 rounded-lg bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => navigate(0)} className="px-3 py-2 rounded-lg bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] text-sm transition-colors">Today</button>
          <button onClick={() => navigate(1)} aria-label="Next" className="p-2 rounded-lg bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h2 className="text-lg font-semibold text-white">{titleFor(view, anchor)}</h2>
        <div className="ml-auto flex gap-1 bg-white/[0.04] p-1 rounded-xl">
          {(['month', 'week', 'day'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${view === v ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}>{v}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        </div>
      ) : unavailable ? (
        <div className="glass-card p-8 text-center text-sm text-slate-400">
          The content calendar is unavailable. Apply the latest database migrations to enable this view.
        </div>
      ) : (
        <>
          {/* MONTH */}
          {view === 'month' && (
            <div className="glass-card p-3 overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {DOW.map(d => <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((d) => {
                    const inMonth = d.getMonth() === anchor.getMonth()
                    const isToday = sameDay(d, today)
                    const dayPosts = postsOn(d)
                    const shown = dayPosts.slice(0, 3)
                    const extra = dayPosts.length - shown.length
                    return (
                      <div key={d.toISOString()} className={`min-h-[96px] rounded-lg border p-1.5 flex flex-col gap-1 ${inMonth ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.04] bg-transparent opacity-50'}`}>
                        <div className={`text-xs mb-0.5 ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white font-semibold' : 'text-slate-400'}`}>{d.getDate()}</div>
                        {shown.map(p => <PostChip key={p.id} post={p} onClick={() => setSelected(p)} />)}
                        {extra > 0 && (
                          <button onClick={() => { setView('day'); setAnchor(startOfDay(d)) }} className="text-[10px] text-sky-400 hover:underline text-left px-1.5">+{extra} more</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* WEEK */}
          {view === 'week' && (
            <div className="glass-card p-3 overflow-x-auto">
              <div className="min-w-[720px] grid grid-cols-7 gap-2">
                {weekDays.map(d => {
                  const isToday = sameDay(d, today)
                  const dayPosts = postsOn(d)
                  return (
                    <div key={d.toISOString()} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 flex flex-col gap-1.5 min-h-[200px]">
                      <div className="text-center mb-1">
                        <div className="text-xs text-slate-400">{DOW[d.getDay()]}</div>
                        <div className={`text-sm ${isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-semibold mt-0.5' : 'text-white'}`}>{d.getDate()}</div>
                      </div>
                      {dayPosts.length === 0 ? (
                        <div className="text-[10px] text-slate-600 text-center pt-2">—</div>
                      ) : dayPosts.map(p => <PostChip key={p.id} post={p} onClick={() => setSelected(p)} />)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DAY */}
          {view === 'day' && (
            <div className="glass-card p-4">
              {postsOn(anchor).length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-10">No posts scheduled for this day.</div>
              ) : (
                <div className="space-y-2">
                  {postsOn(anchor).map(p => (
                    <button key={p.id} onClick={() => setSelected(p)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-left transition-colors">
                      <span className="text-xs text-slate-400 w-16 shrink-0">{timeLabel(p.scheduled_date)}</span>
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <PlatformDot platform={p.platform} />
                        <span className="text-[11px] font-medium text-slate-300">{meta(p.platform).label}</span>
                      </span>
                      <span className="text-sm text-slate-200 truncate flex-1">{p.post_content || <span className="text-slate-500">No caption</span>}</span>
                      {p.client_name && <span className="text-xs text-slate-500 shrink-0 hidden sm:inline">{p.client_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(posts || []).length === 0 && view !== 'day' && (
            <p className="text-center text-xs text-slate-500 mt-3">No posts scheduled in this period.</p>
          )}
        </>
      )}

      {/* Detail popover */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="glass-card w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: meta(selected.platform).color }}>{meta(selected.platform).label}</span>
              <button onClick={() => setSelected(null)} aria-label="Close" className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="text-slate-400 text-xs">{selected.client_name || 'Unknown client'}{selected.project_name ? ` · ${selected.project_name}` : ''}</div>
              <p className="text-slate-200 whitespace-pre-wrap break-words">{selected.post_content || <span className="text-slate-500">No caption</span>}</p>
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                <span>{selected.scheduled_date ? new Date(selected.scheduled_date).toLocaleString() : 'Unscheduled'}</span>
                {selected.status && <span className={`px-2 py-0.5 rounded-md ${selected.status === 'scheduled' ? 'bg-sky-500/15 text-sky-300' : selected.status === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-400'}`}>{selected.status}</span>}
              </div>
              {selected.live_link && (
                <a href={selected.live_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline pt-1"><Link2 className="h-3 w-3" /> View live post</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
