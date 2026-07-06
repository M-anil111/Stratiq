'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, BarChart2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'

const PRESETS = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Last month', 'Custom'] as const
type Preset = typeof PRESETS[number]

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

function rangeFor(preset: Preset): { start: string; end: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'Today': return { start: fmt(today), end: fmt(today) }
    case 'Yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { start: fmt(y), end: fmt(y) } }
    case 'Last 7 days': { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: fmt(s), end: fmt(today) } }
    case 'Last month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: fmt(s), end: fmt(e) } }
    case 'Last 30 days':
    default: { const s = new Date(today); s.setDate(s.getDate() - 29); return { start: fmt(s), end: fmt(today) } }
  }
}

function fmtDuration(sec: number) {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

function pct(cur: number, prev: number | undefined | null) {
  if (prev === undefined || prev === null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

export default function AnalyticsTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [unlinked, setUnlinked] = useState(false)
  const [notConnected, setNotConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // linking
  const [properties, setProperties] = useState<{ property_id: string; display_name: string }[]>([])
  const [propsLoading, setPropsLoading] = useState(false)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  // date range
  const [preset, setPreset] = useState<Preset>('Last 30 days')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    let range = rangeFor(preset)
    if (preset === 'Custom' && customStart && customEnd) range = { start: customStart, end: customEnd }
    try {
      const res = await fetch(`/api/clients/${clientId}/analytics?start=${range.start}&end=${range.end}`)
      const d = await res.json()
      if (d?.__unlinked) { setUnlinked(true); setData(null) }
      else if (d?.error === 'not_connected') { setNotConnected(true); setUnlinked(true) }
      else if (d?.error) { setError(d.error) }
      else { setUnlinked(false); setData(d) }
    } catch { setError('Failed to load analytics') }
    finally { setLoading(false) }
  }, [clientId, preset, customStart, customEnd])

  useEffect(() => { load() }, [load])

  // load property list when unlinked (and org is connected)
  useEffect(() => {
    if (!unlinked || notConnected) return
    setPropsLoading(true)
    fetch(`/api/clients/${clientId}/ga-properties`)
      .then(r => r.json())
      .then(d => {
        if (d?.error === 'not_connected') setNotConnected(true)
        else if (Array.isArray(d)) setProperties(d)
      })
      .catch(() => {})
      .finally(() => setPropsLoading(false))
  }, [unlinked, notConnected, clientId])

  const saveProperty = async () => {
    if (!selected) return
    setSaving(true)
    const prop = properties.find(p => p.property_id === selected)
    const res = await fetch(`/api/clients/${clientId}/ga-properties`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: selected, display_name: prop?.display_name }),
    })
    setSaving(false)
    if (res.ok) { setUnlinked(false); load() }
  }

  const sel = 'bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

  if (loading && !data && !unlinked) {
    return <div className="space-y-4"><div className="h-10 w-64 skeleton rounded-lg" /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)}</div><div className="h-64 skeleton rounded-xl" /></div>
  }

  // Unlinked → connect panel
  if (unlinked) {
    return (
      <div className="max-w-xl">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400"><BarChart2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Connect Google Analytics</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">Link a GA4 property to view this client&apos;s traffic</p>
            </div>
          </div>
          {notConnected ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
              Google is not connected for your organization. <a href="/settings/integrations" className="underline hover:text-amber-200 inline-flex items-center gap-1">Connect in Settings → Integrations <ExternalLink className="h-3 w-3" /></a>
            </div>
          ) : propsLoading ? (
            <div className="h-10 skeleton rounded-lg" />
          ) : properties.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No GA4 properties found for the connected Google account.</p>
          ) : (
            <div className="flex gap-2">
              <select value={selected} onChange={e => setSelected(e.target.value)} className={`flex-1 ${sel}`}>
                <option value="">Select a GA4 property…</option>
                {properties.map(p => <option key={p.property_id} value={p.property_id}>{p.display_name} ({p.property_id})</option>)}
              </select>
              <button disabled={!selected || saving} onClick={saveProperty} className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (error) return <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 max-w-xl">{error}</div>

  const s = data?.summary || {}
  const prev = data?.previous
  const tiles = [
    { label: 'Sessions', value: (s.sessions || 0).toLocaleString(), delta: pct(s.sessions, prev?.sessions) },
    { label: 'Users', value: (s.users || 0).toLocaleString(), delta: pct(s.users, prev?.users) },
    { label: 'Pageviews', value: (s.pageviews || 0).toLocaleString(), delta: pct(s.pageviews, prev?.pageviews) },
    { label: 'New Sessions', value: (s.newSessions || 0).toLocaleString(), delta: pct(s.newSessions, prev?.newSessions) },
    { label: 'Avg Duration', value: fmtDuration(s.avgSessionDuration || 0), delta: pct(s.avgSessionDuration, prev?.avgSessionDuration) },
    { label: 'Pages/Session', value: (s.pagesPerSession || 0).toFixed(2), delta: pct(s.pagesPerSession, prev?.pagesPerSession) },
  ]
  const maxSessions = Math.max(1, ...(data?.timeseries || []).map((d: any) => d.sessions))
  const sourceMax = Math.max(1, ...(data?.trafficSources || []).map((d: any) => d.sessions))
  const deviceTotal = Math.max(1, (data?.devices || []).reduce((a: number, d: any) => a + d.sessions, 0))

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => (
          <button key={p} onClick={() => setPreset(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${preset === p ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'border-slate-900/10 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-white'}`}>{p}</button>
        ))}
        {preset === 'Custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={sel} />
            <span className="text-slate-500 text-xs">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={sel} />
          </div>
        )}
        {data?.property_name && <span className="ml-auto text-xs text-slate-500 truncate">{data.property_name}</span>}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="glass-card p-4">
            <p className="text-xs text-slate-500 mb-1">{t.label}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{t.value}</p>
            {t.delta !== null && (
              <p className={`text-xs mt-1 flex items-center gap-0.5 ${t.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(t.delta).toFixed(1)}%
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Daily sessions bar chart */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Sessions over time</h3>
        {(!data?.timeseries || data.timeseries.length === 0) ? (
          <p className="text-sm text-slate-500 py-8 text-center">No data for this range</p>
        ) : (
          <div className="flex items-end gap-0.5 h-40">
            {data.timeseries.map((d: any) => (
              <div key={d.date} className="flex-1 group relative flex items-end" title={`${d.date}: ${d.sessions} sessions`}>
                <div className="w-full bg-sky-500/60 hover:bg-sky-400 rounded-t transition-colors" style={{ height: `${(d.sessions / maxSessions) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic sources */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Traffic Sources</h3>
          <div className="space-y-2.5">
            {(data?.trafficSources || []).map((src: any) => (
              <div key={src.label}>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-700 dark:text-slate-300 truncate">{src.label}</span><span className="text-slate-500">{src.sessions.toLocaleString()}</span></div>
                <div className="h-1.5 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.06]"><div className="h-full rounded-full bg-sky-400" style={{ width: `${(src.sessions / sourceMax) * 100}%` }} /></div>
              </div>
            ))}
            {(data?.trafficSources || []).length === 0 && <p className="text-xs text-slate-500">No data</p>}
          </div>
        </div>

        {/* Top countries */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Top Countries</h3>
          <div className="space-y-2">
            {(data?.countries || []).map((c: any) => (
              <div key={c.label} className="flex justify-between text-sm"><span className="text-slate-700 dark:text-slate-300 truncate">{c.label}</span><span className="text-slate-500">{c.sessions.toLocaleString()}</span></div>
            ))}
            {(data?.countries || []).length === 0 && <p className="text-xs text-slate-500">No data</p>}
          </div>
        </div>

        {/* Devices */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Devices</h3>
          <div className="space-y-3">
            {(data?.devices || []).map((d: any) => (
              <div key={d.label}>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-700 dark:text-slate-300 capitalize">{d.label}</span><span className="text-slate-500">{((d.sessions / deviceTotal) * 100).toFixed(0)}%</span></div>
                <div className="h-1.5 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.06]"><div className="h-full rounded-full bg-violet-400" style={{ width: `${(d.sessions / deviceTotal) * 100}%` }} /></div>
              </div>
            ))}
            {(data?.devices || []).length === 0 && <p className="text-xs text-slate-500">No data</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
