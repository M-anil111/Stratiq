'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, ChevronLeft, Search, TrendingUp, TrendingDown, Minus, Check } from 'lucide-react'
import AddButton from '@/components/ui/AddButton'

function today() { return new Date().toISOString().split('T')[0] }

const ENGINES = ['google', 'bing']

const emptyForm = () => ({ keyword: '', search_engine: 'google', location: '', target_url: '' })

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

type Keyword = {
  id: string
  keyword: string
  search_engine: string
  location: string | null
  target_url: string | null
  latest_position: number | null
  previous_position: number | null
  history: (number | null)[]
}

// Tiny inline SVG sparkline of recent positions (lower = better, so invert Y)
function Sparkline({ points }: { points: (number | null)[] }) {
  const vals = points.filter((p): p is number => p != null)
  if (vals.length < 2) return <span className="text-slate-600 text-xs">—</span>
  const w = 64, h = 20, pad = 2
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const step = (w - pad * 2) / (vals.length - 1)
  // invert: better rank (lower number) should be higher on chart
  const coords = vals.map((v, i) => {
    const x = pad + i * step
    const y = pad + ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const improving = vals[vals.length - 1] <= vals[0]
  const color = improving ? '#34d399' : '#f87171'
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function PositionChange({ latest, previous }: { latest: number | null; previous: number | null }) {
  if (latest == null || previous == null) return <span className="text-slate-600">—</span>
  const diff = previous - latest // positive = improved (rank number decreased)
  if (diff === 0) return <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><Minus className="h-3 w-3" />0</span>
  if (diff > 0) return <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><TrendingUp className="h-3 w-3" />{diff}</span>
  return <span className="inline-flex items-center gap-1 text-red-400 text-xs"><TrendingDown className="h-3 w-3" />{Math.abs(diff)}</span>
}

export default function KeywordsPage({ params }: { params: { id: string; projectId: string } }) {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editKw, setEditKw] = useState<Keyword | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [rankRowId, setRankRowId] = useState<string | null>(null)
  const [rankValue, setRankValue] = useState('')
  const [savingRank, setSavingRank] = useState(false)

  const load = useCallback((q?: string) => {
    setLoading(true)
    const url = `/api/projects/${params.projectId}/keywords${q ? `?search=${encodeURIComponent(q)}` : ''}`
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data?.__unavailable) { setUnavailable(true); setKeywords([]) }
        else { setUnavailable(false); setKeywords(Array.isArray(data) ? data : []) }
      })
      .catch(() => setKeywords([]))
      .finally(() => setLoading(false))
  }, [params.projectId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, load])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditKw(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (kw: Keyword) => {
    setEditKw(kw)
    setForm({ keyword: kw.keyword, search_engine: kw.search_engine || 'google', location: kw.location || '', target_url: kw.target_url || '' })
    setShowForm(true)
  }
  const closeModal = () => { setShowForm(false); setEditKw(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editKw) {
        const res = await fetch(`/api/projects/${params.projectId}/keywords/${editKw.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const data = await res.json()
          setKeywords(p => p.map(x => x.id === editKw.id ? { ...x, ...data } : x))
          closeModal()
        }
      } else {
        const res = await fetch(`/api/projects/${params.projectId}/keywords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const data = await res.json()
          setKeywords(p => [data, ...p])
          closeModal()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/keywords/${deleteId}`, { method: 'DELETE' })
      if (res.ok) { setKeywords(p => p.filter(x => x.id !== deleteId)); setDeleteId(null) }
    } finally {
      setDeleting(false)
    }
  }

  const openRank = (kw: Keyword) => { setRankRowId(kw.id); setRankValue(kw.latest_position != null ? String(kw.latest_position) : '') }
  const saveRank = async (kw: Keyword) => {
    setSavingRank(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/keywords/${kw.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: rankValue, checked_on: today() }),
      })
      if (res.ok) {
        const pos = rankValue === '' ? null : parseInt(rankValue, 10)
        setKeywords(p => p.map(x => x.id === kw.id ? {
          ...x,
          previous_position: x.latest_position,
          latest_position: Number.isNaN(pos as any) ? null : pos,
          history: [...x.history, Number.isNaN(pos as any) ? null : pos],
        } : x))
        setRankRowId(null)
      }
    } finally {
      setSavingRank(false)
    }
  }

  const total = keywords.length
  const top3 = keywords.filter(k => k.latest_position != null && k.latest_position <= 3).length
  const top10 = keywords.filter(k => k.latest_position != null && k.latest_position <= 10).length
  const improved = keywords.filter(k => k.latest_position != null && k.previous_position != null && k.latest_position < k.previous_position).length

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${params.id}/projects/${params.projectId}`} className="p-2 hover:bg-white/[0.06] rounded-lg">
          <ChevronLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Keyword Rank Tracking</h1>
          <p className="text-sm text-slate-500">Track keyword positions over time</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Keywords', value: total },
          { label: 'In Top 3', value: top3 },
          { label: 'In Top 10', value: top10 },
          { label: 'Improved', value: improved },
        ].map(tile => (
          <div key={tile.label} className="glass-card p-4">
            <div className="text-2xl font-bold text-white">{tile.value}</div>
            <div className="text-xs text-slate-500 mt-1">{tile.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="font-semibold text-white whitespace-nowrap">Keywords ({total})</h2>
            <div className="relative max-w-xs w-full">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input-glass pl-9"
                placeholder="Search keywords..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <AddButton label="Add keyword" size="sm" onClick={openAdd} />
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : unavailable ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">Rank tracking not enabled</p>
            <p className="text-sm mt-1">Run migration 035 to enable rank tracking</p>
          </div>
        ) : keywords.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No keywords tracked yet</p>
            <p className="text-sm mt-1">Click &quot;Add keyword&quot; to start tracking rankings</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Keyword', 'Engine', 'Location', 'Position', 'Change', 'Trend', 'Target URL', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {keywords.map(kw => (
                  <tr key={kw.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate">{kw.keyword}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{kw.search_engine || 'google'}</td>
                    <td className="px-4 py-3 text-slate-400">{kw.location || '—'}</td>
                    <td className="px-4 py-3">
                      {rankRowId === kw.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            autoFocus
                            className="w-16 bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                            value={rankValue}
                            onChange={e => setRankValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRank(kw); if (e.key === 'Escape') setRankRowId(null) }}
                          />
                          <button onClick={() => saveRank(kw)} disabled={savingRank} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                            {savingRank ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button onClick={() => setRankRowId(null)} className="p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <span className="text-white font-medium">{kw.latest_position != null ? kw.latest_position : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><PositionChange latest={kw.latest_position} previous={kw.previous_position} /></td>
                    <td className="px-4 py-3"><Sparkline points={kw.history} /></td>
                    <td className="px-4 py-3">
                      {kw.target_url ? (
                        <a href={kw.target_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                          <ExternalLink className="h-3 w-3" />View
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {deleteId === kw.id ? (
                        <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-2 py-1">
                          <span className="text-red-400">Delete?</span>
                          <button onClick={() => setDeleteId(null)} className="px-2 py-0.5 border border-white/[0.10] rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-60">
                            {deleting ? '...' : 'Delete'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => openRank(kw)} title="Update rank" className="px-2 py-1 text-xs rounded border border-white/[0.10] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all whitespace-nowrap">Update rank</button>
                          <button onClick={() => openEdit(kw)} title="Edit" className="p-1 text-slate-400 hover:text-sky-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteId(kw.id)} title="Delete" className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">{editKw ? 'Edit Keyword' : 'Add Keyword'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Keyword <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.keyword} onChange={set('keyword')} placeholder="e.g. best running shoes" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Search Engine</label>
                  <select className={selectClass} value={form.search_engine} onChange={set('search_engine')}>
                    {ENGINES.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                  <input className="input-glass" value={form.location} onChange={set('location')} placeholder="e.g. United States" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target URL</label>
                <input className="input-glass" type="url" value={form.target_url} onChange={set('target_url')} placeholder="https://..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 btn-brand disabled:opacity-60 text-sm font-medium">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : editKw ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
