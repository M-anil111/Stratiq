'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Link2, Sparkles, X } from 'lucide-react'

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
type Client = { id: string; company_name: string }
type RecRange = { start: string; end: string; score: number }
type RecDay = { day: number; ranges: RecRange[] }
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

  // Filters.
  const [clients, setClients] = useState<Client[]>([])
  const [fClient, setFClient] = useState('')   // client_name
  const [fPlatform, setFPlatform] = useState('')
  const [fStatus, setFStatus] = useState('')

  // Recommended-times overlay (Hootsuite-style faint markers).
  const [showRec, setShowRec] = useState(true)
  const [recommended, setRecommended] = useState<RecDay[] | null>(null)

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor])

  // Client list for the filter (best-effort).
  useEffect(() => {
    fetch('/api/clients?limit=200')
      .then(r => r.json())
      .then((d) => { if (Array.isArray(d?.clients)) setClients(d.clients) })
      .catch(() => {})
  }, [])

  // Recommended posting times (org history or industry defaults).
  useEffect(() => {
    const qs = fPlatform ? `?platform=${encodeURIComponent(fPlatform)}` : ''
    fetch(`/api/social/recommended-times${qs}`)
      .then(r => r.json())
      .then((d) => { if (Array.isArray(d?.recommended)) setRecommended(d.recommended) })
      .catch(() => {})
  }, [fPlatform])

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

  // Apply client-side filters.
  const filtered = useMemo(() => {
    return (posts || []).filter(p => {
      if (fClient && (p.client_name || '') !== fClient) return false
      if (fPlatform && (p.platform || '').toLowerCase() !== fPlatform.toLowerCase()) return false
      if (fStatus && (p.status || '') !== fStatus) return false
      return true
    })
  }, [posts, fClient, fPlatform, fStatus])

  // Distinct platforms / statuses present, for filter dropdowns.
  const platformOptions = useMemo(() => {
    const s = new Set<string>()
    for (const p of posts || []) if (p.platform) s.add(p.platform.toLowerCase())
    return Array.from(s).sort()
  }, [posts])
  const statusOptions = useMemo(() => {
    const s = new Set<string>()
    for (const p of posts || []) if (p.status) s.add(p.status)
    return Array.from(s).sort()
  }, [posts])

  // Group posts by day key (local).
  const byDay = useMemo(() => {
    const m: Record<string, CalPost[]> = {}
    for (const p of filtered) {
      if (!p.scheduled_date) continue
      const d = new Date(p.scheduled_date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      ;(m[key] = m[key] || []).push(p)
    }
    Object.keys(m).forEach(k => {
      m[k].sort((a: CalPost, b: CalPost) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
    })
    return m
  }, [filtered])
  function postsOn(d: Date) { return byDay[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] || [] }

  // Per-day status counts (scheduled / draft / published) for headers.
  function statusCounts(d: Date) {
    const list = postsOn(d)
    const c = { scheduled: 0, draft: 0, published: 0 }
    for (const p of list) {
      const s = (p.status || '').toLowerCase()
      if (s === 'scheduled') c.scheduled++
      else if (s === 'draft') c.draft++
      else if (s === 'published' || s === 'live') c.published++
    }
    return c
  }

  // Recommended ranges for a given weekday (for the overlay markers).
  function recFor(d: Date): RecRange[] {
    if (!showRec || !recommended) return []
    return (recommended.find(r => r.day === d.getDay())?.ranges || []).slice(0, 3)
  }
  function recTitle(d: Date): string {
    const platLabel = fPlatform ? ` for ${meta(fPlatform).label}` : ''
    return `Recommended time${platLabel}`
  }

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={fClient}
          onChange={e => setFClient(e.target.value)}
          className="bg-white/[0.06] border border-white/[0.12] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.company_name}>{c.company_name}</option>)}
        </select>
        <select
          value={fPlatform}
          onChange={e => setFPlatform(e.target.value)}
          className="bg-white/[0.06] border border-white/[0.12] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        >
          <option value="">All platforms</option>
          {platformOptions.map(p => <option key={p} value={p}>{meta(p).label}</option>)}
        </select>
        <select
          value={fStatus}
          onChange={e => setFStatus(e.target.value)}
          className="bg-white/[0.06] border border-white/[0.12] text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        >
          <option value="">All statuses</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(fClient || fPlatform || fStatus) && (
          <button onClick={() => { setFClient(''); setFPlatform(''); setFStatus('') }} className="text-xs text-slate-400 hover:text-white px-1.5 py-1">Clear</button>
        )}
        <button
          onClick={() => setShowRec(s => !s)}
          aria-pressed={showRec}
          title="Overlay recommended posting times"
          className={`ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showRec
            ? 'bg-amber-400/15 text-amber-200 border-amber-400/30'
            : 'bg-white/[0.06] text-slate-400 border-white/[0.12] hover:text-white'}`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Recommended times
        </button>
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
                    const counts = statusCounts(d)
                    const rec = recFor(d)
                    return (
                      <div key={d.toISOString()} className={`min-h-[96px] rounded-lg border p-1.5 flex flex-col gap-1 ${inMonth ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.04] bg-transparent opacity-50'}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white font-semibold' : 'text-slate-400'}`}>{d.getDate()}</span>
                          {(counts.scheduled + counts.draft + counts.published) > 0 && (
                            <span className="flex items-center gap-1 text-[9px]">
                              {counts.scheduled > 0 && <span className="text-sky-300" title="Scheduled">{counts.scheduled}s</span>}
                              {counts.draft > 0 && <span className="text-slate-400" title="Draft">{counts.draft}d</span>}
                              {counts.published > 0 && <span className="text-emerald-300" title="Published">{counts.published}p</span>}
                            </span>
                          )}
                        </div>
                        {rec.length > 0 && (
                          <div className="flex flex-wrap gap-1" title={recTitle(d)}>
                            {rec.map(r => (
                              <span key={r.start} className="text-[9px] px-1 py-0.5 rounded bg-amber-400/10 text-amber-300/70 border border-amber-400/20" title={`${recTitle(d)} · ${r.start}–${r.end}`}>
                                <Sparkles className="inline h-2.5 w-2.5 -mt-0.5" /> {r.start}
                              </span>
                            ))}
                          </div>
                        )}
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
                  const counts = statusCounts(d)
                  const rec = recFor(d)
                  return (
                    <div key={d.toISOString()} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 flex flex-col gap-1.5 min-h-[200px]">
                      <div className="text-center mb-1">
                        <div className="text-xs text-slate-400">{DOW[d.getDay()]}</div>
                        <div className={`text-sm ${isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white font-semibold mt-0.5' : 'text-white'}`}>{d.getDate()}</div>
                        {(counts.scheduled + counts.draft + counts.published) > 0 && (
                          <div className="flex items-center justify-center gap-1.5 text-[9px] mt-0.5">
                            {counts.scheduled > 0 && <span className="text-sky-300" title="Scheduled">{counts.scheduled}s</span>}
                            {counts.draft > 0 && <span className="text-slate-400" title="Draft">{counts.draft}d</span>}
                            {counts.published > 0 && <span className="text-emerald-300" title="Published">{counts.published}p</span>}
                          </div>
                        )}
                      </div>
                      {rec.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center" title={recTitle(d)}>
                          {rec.map(r => (
                            <span key={r.start} className="text-[9px] px-1 py-0.5 rounded bg-amber-400/10 text-amber-300/70 border border-amber-400/20" title={`${recTitle(d)} · ${r.start}–${r.end}`}>
                              <Sparkles className="inline h-2.5 w-2.5 -mt-0.5" /> {r.start}
                            </span>
                          ))}
                        </div>
                      )}
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

          {filtered.length === 0 && view !== 'day' && (
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
