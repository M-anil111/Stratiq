'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Search, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

const PRESETS = ['Last 7 days', 'Last 30 days', 'Last month', 'Custom'] as const
type Preset = typeof PRESETS[number]

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

function rangeFor(preset: Preset): { start: string; end: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'Last 7 days': { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: fmt(s), end: fmt(today) } }
    case 'Last month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: fmt(s), end: fmt(e) } }
    case 'Last 30 days':
    default: { const s = new Date(today); s.setDate(s.getDate() - 29); return { start: fmt(s), end: fmt(today) } }
  }
}

const DIMS = ['queries', 'pages', 'countries', 'devices'] as const
type Dim = typeof DIMS[number]
const DIM_LABEL: Record<Dim, string> = { queries: 'Queries', pages: 'Pages', countries: 'Countries', devices: 'Devices' }
const COL_LABEL: Record<Dim, string> = { queries: 'Query', pages: 'Page', countries: 'Country', devices: 'Device' }

type SortKey = 'key' | 'clicks' | 'impressions' | 'ctr' | 'position'

export default function SearchConsoleTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [unlinked, setUnlinked] = useState(false)
  const [notConnected, setNotConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sites, setSites] = useState<{ site_url: string }[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  const [preset, setPreset] = useState<Preset>('Last 30 days')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [dim, setDim] = useState<Dim>('queries')
  const [sortKey, setSortKey] = useState<SortKey>('clicks')
  const [sortDesc, setSortDesc] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    let range = rangeFor(preset)
    if (preset === 'Custom' && customStart && customEnd) range = { start: customStart, end: customEnd }
    try {
      const res = await fetch(`/api/clients/${clientId}/search-console?start=${range.start}&end=${range.end}`)
      const d = await res.json()
      if (d?.__unlinked) { setUnlinked(true); setData(null) }
      else if (d?.error === 'not_connected') { setNotConnected(true); setUnlinked(true) }
      else if (d?.error) { setError(d.error) }
      else { setUnlinked(false); setData(d) }
    } catch { setError('Failed to load Search Console') }
    finally { setLoading(false) }
  }, [clientId, preset, customStart, customEnd])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!unlinked || notConnected) return
    setSitesLoading(true)
    fetch(`/api/clients/${clientId}/gsc-sites`)
      .then(r => r.json())
      .then(d => {
        if (d?.error === 'not_connected') setNotConnected(true)
        else if (Array.isArray(d)) setSites(d)
      })
      .catch(() => {})
      .finally(() => setSitesLoading(false))
  }, [unlinked, notConnected, clientId])

  const saveSite = async () => {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/gsc-sites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_url: selected }),
    })
    setSaving(false)
    if (res.ok) { setUnlinked(false); load() }
  }

  const sel = 'bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

  if (loading && !data && !unlinked) {
    return <div className="space-y-4"><div className="h-10 w-64 skeleton rounded-lg" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)}</div><div className="h-64 skeleton rounded-xl" /></div>
  }

  if (unlinked) {
    return (
      <div className="max-w-xl">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400"><Search className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Connect Search Console</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">Link a verified GSC site to view this client&apos;s search performance</p>
            </div>
          </div>
          {notConnected ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
              Google is not connected for your organization. <a href="/settings/integrations" className="underline hover:text-amber-200 inline-flex items-center gap-1">Connect in Settings → Integrations <ExternalLink className="h-3 w-3" /></a>
            </div>
          ) : sitesLoading ? (
            <div className="h-10 skeleton rounded-lg" />
          ) : sites.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No verified Search Console sites found for the connected Google account.</p>
          ) : (
            <div className="flex gap-2">
              <select value={selected} onChange={e => setSelected(e.target.value)} className={`flex-1 ${sel}`}>
                <option value="">Select a site…</option>
                {sites.map(s => <option key={s.site_url} value={s.site_url}>{s.site_url}</option>)}
              </select>
              <button disabled={!selected || saving} onClick={saveSite} className="btn-brand px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (error) return <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 max-w-xl">{error}</div>

  const s = data?.summary || {}
  const tiles = [
    { label: 'Clicks', value: (s.clicks || 0).toLocaleString() },
    { label: 'Impressions', value: (s.impressions || 0).toLocaleString() },
    { label: 'CTR', value: `${((s.ctr || 0) * 100).toFixed(2)}%` },
    { label: 'Avg Position', value: (s.position || 0).toFixed(1) },
  ]
  const maxClicks = Math.max(1, ...(data?.timeseries || []).map((d: any) => d.clicks))
  const rows: any[] = [...(data?.[dim] || [])]
  rows.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv))
    return sortDesc ? bv - av : av - bv
  })

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDesc(d => !d)
    else { setSortKey(k); setSortDesc(k !== 'key' && k !== 'position') }
  }
  const SortHead = ({ k, label, align = 'right' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={`py-2 px-3 text-xs text-slate-500 font-medium cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => setSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{sortKey === k && (sortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}</span>
    </th>
  )

  return (
    <div className="space-y-6">
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
        {data?.site_url && <span className="ml-auto text-xs text-slate-500 truncate">{data.site_url}</span>}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="glass-card p-4">
            <p className="text-xs text-slate-500 mb-1">{t.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Daily clicks */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-4">Clicks over time</h3>
        {(!data?.timeseries || data.timeseries.length === 0) ? (
          <EmptyState icon={Search} title="No data for this range" description="Try a wider date range or check back once Search Console data syncs." size="sm" />
        ) : (
          <div className="flex items-end gap-0.5 h-40">
            {data.timeseries.map((d: any) => (
              <div key={d.date} className="flex-1 flex items-end" title={`${d.date}: ${d.clicks} clicks`}>
                <div className="w-full bg-emerald-500/60 hover:bg-emerald-400 rounded-t transition-colors" style={{ height: `${(d.clicks / maxClicks) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabbed table */}
      <div className="glass-card overflow-hidden">
        <div className="flex border-b border-slate-900/10 dark:border-white/[0.08]">
          {DIMS.map(d => (
            <button key={d} onClick={() => setDim(d)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${dim === d ? 'text-slate-900 dark:text-white border-sky-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-white'}`}>{DIM_LABEL[d]}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-900/10 dark:border-white/[0.08]">
                <SortHead k="key" label={COL_LABEL[dim]} align="left" />
                <SortHead k="clicks" label="Clicks" />
                <SortHead k="impressions" label="Impressions" />
                <SortHead k="ctr" label="CTR" />
                <SortHead k="position" label="Position" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500 text-sm">No data</td></tr>
              ) : rows.map((r, i) => (
                <tr key={`${r.key}-${i}`} className="border-b border-slate-900/10 dark:border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 text-slate-200 max-w-[280px] truncate" title={r.key}>{r.key || '(not set)'}</td>
                  <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">{r.clicks.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{r.impressions.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{(r.ctr * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
