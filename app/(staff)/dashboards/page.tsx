'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, Plus, Star, MoreHorizontal, X, Trash2, Copy,
  ExternalLink, Info, History, CheckCircle, Lock, Eye, Pencil,
  RotateCcw, AlertTriangle, Clock,
} from 'lucide-react'

interface DashboardRow {
  id: string
  name: string
  description: string | null
  owner_id: string | null
  access: 'private' | 'everyone_view' | 'everyone_edit'
  favorited_by: string[]
  widgets: { id: string; type: string; title: string; config: Record<string, any> }[]
  deleted_at: string | null
  created_at: string
  updated_at: string
  owner?: { id: string; full_name: string | null; email: string | null } | null
}

interface ActivityRow {
  id: string
  action: string
  detail: string | null
  created_at: string
  user?: { id: string; full_name: string | null; email: string | null } | null
}

interface TeamMember { id: string; full_name: string | null; email: string | null }

const ACCESS_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  private:       { label: 'Private',              icon: Lock,   cls: 'bg-amber-500/10 border-amber-500/25 text-amber-300' },
  everyone_view: { label: 'Everyone can view',    icon: Eye,    cls: 'bg-sky-500/10 border-sky-500/25 text-sky-300' },
  everyone_edit: { label: 'Everyone can edit',    icon: Pencil, cls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' },
}

const TEMPLATES: { id: string; name: string; description: string; widgets: { type: string; label: string }[] }[] = [
  { id: 'blank', name: 'Blank dashboard', description: 'Start from scratch and add widgets later', widgets: [] },
  {
    id: 'marketing', name: 'Marketing', description: 'MRR, recent activity and the leads pipeline',
    widgets: [
      { type: 'stats_tile', label: 'Total MRR tile' },
      { type: 'activity_feed', label: 'Recent activity feed' },
      { type: 'leads_pipeline', label: 'Leads pipeline' },
    ],
  },
  {
    id: 'service', name: 'Service', description: 'Overdue tasks, activity and top clients',
    widgets: [
      { type: 'tasks_due', label: 'Overdue tasks' },
      { type: 'activity_feed', label: 'Recent activity feed' },
      { type: 'top_clients', label: 'Top clients by MRR' },
    ],
  },
  {
    id: 'billing', name: 'Billing', description: 'Outstanding and paid invoice totals plus status breakdown',
    widgets: [
      { type: 'stats_tile', label: 'Invoice tiles (outstanding & paid)' },
      { type: 'invoice_status', label: 'Invoices by status' },
    ],
  },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function AccessBadge({ access }: { access: string }) {
  const meta = ACCESS_META[access] || ACCESS_META.everyone_edit
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.cls}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

function DashboardsManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const manage = searchParams.get('manage') === '1'

  const [dashboards, setDashboards] = useState<DashboardRow[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [me, setMe] = useState<{ id: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Panels & modals
  const [showCreate, setShowCreate] = useState(false)
  const [detailsFor, setDetailsFor] = useState<DashboardRow | null>(null)
  const [activityFor, setActivityFor] = useState<DashboardRow | null>(null)
  const [deleteFor, setDeleteFor] = useState<DashboardRow[] | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deletedRows, setDeletedRows] = useState<DashboardRow[] | null>(null)

  const isAdmin = me?.role === 'admin' || me?.role === 'super_admin'
  const menuRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboards')
      const data = await res.json()
      if (data?.__unavailable) { setUnavailable(true); return }
      if (!res.ok) { setError(data?.error || 'Failed to load dashboards'); return }
      setDashboards(data.dashboards || [])
      setDefaultId(data.default_dashboard_id || null)
      return data
    } catch {
      setError('Failed to load dashboards')
    }
  }, [])

  useEffect(() => {
    Promise.all([
      load(),
      fetch('/api/me').then(r => r.json()).then(d => { if (d?.id) setMe({ id: d.id, role: d.role }) }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [load])

  // Redirect to the user's default dashboard unless explicitly managing
  useEffect(() => {
    if (!loading && !manage && defaultId) {
      setRedirecting(true)
      router.replace(`/dashboards/${defaultId}`)
    }
  }, [loading, manage, defaultId, router])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggleFavorite = async (d: DashboardRow) => {
    const isFav = me ? (d.favorited_by || []).includes(me.id) : false
    const res = await fetch(`/api/dashboards/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: !isFav }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data?.error || 'Failed to update favorite'); return }
    setDashboards(prev => prev.map(x => x.id === d.id ? { ...x, favorited_by: data.favorited_by } : x))
  }

  const setAsDefault = async (d: DashboardRow, on: boolean) => {
    const res = await fetch(`/api/dashboards/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set_default: on }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data?.error || 'Failed to set default'); return }
    setDefaultId(on ? d.id : null)
    setMenuOpen(null)
  }

  const clone = async (d: DashboardRow) => {
    setMenuOpen(null)
    const res = await fetch(`/api/dashboards/${d.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clone' }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data?.error || 'Failed to clone'); return }
    await load()
  }

  const doDelete = async (rows: DashboardRow[]) => {
    for (const d of rows) {
      const res = await fetch(`/api/dashboards/${d.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || `Failed to delete "${d.name}"`)
      }
    }
    setDeleteFor(null)
    setSelected(new Set())
    await load()
  }

  const loadDeleted = async () => {
    setDeletedRows(null)
    setShowDeleted(true)
    const res = await fetch('/api/dashboards?deleted=1')
    const data = await res.json()
    if (data?.__unavailable || !res.ok) { setDeletedRows([]); return }
    setDeletedRows(data.dashboards || [])
  }

  const restore = async (d: DashboardRow) => {
    const res = await fetch(`/api/dashboards/${d.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data?.error || 'Failed to restore'); return }
    setDeletedRows(prev => (prev || []).filter(x => x.id !== d.id))
    await load()
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const allSelected = dashboards.length > 0 && dashboards.every(d => selected.has(d.id))

  if (redirecting) {
    return (
      <div className="p-5 lg:p-8 min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm">Opening your default dashboard…</div>
      </div>
    )
  }

  return (
    <div className="p-5 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-float-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-medium text-sky-400 uppercase tracking-widest">Dashboards</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Manage dashboards</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create, share and organize dashboards for your team</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create dashboard</span>
        </button>
      </div>

      {unavailable ? (
        <div className="glass-card p-10 text-center text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Dashboards are not set up yet in this environment.</p>
          <p className="text-xs mt-1 text-slate-600">Apply migration 024_dashboards.sql to enable this feature.</p>
        </div>
      ) : error ? (
        <div className="glass-card p-10 text-center text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 glass-card px-4 py-3">
              <span className="text-sm text-slate-300">{selected.size} selected</span>
              <button
                onClick={() => setDeleteFor(dashboards.filter(d => selected.has(d.id)))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
            </div>
          )}

          {/* Table */}
          <div className="glass-card p-0 overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pl-5 pr-3 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(dashboards.map(d => d.id)))}
                        className="accent-sky-500"
                      />
                    </th>
                    <th className="px-2 py-3.5 w-8" />
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-3.5">Name</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-3.5 hidden md:table-cell">Owner</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-3.5 hidden sm:table-cell">Access</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-3.5 hidden lg:table-cell">Updated</th>
                    <th className="px-3 py-3.5 w-14" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loading ? (
                    [1, 2, 3, 4].map(i => (
                      <tr key={i}>
                        <td className="pl-5 pr-3 py-4"><div className="skeleton h-4 w-4" /></td>
                        <td className="px-2 py-4"><div className="skeleton h-4 w-4" /></td>
                        <td className="px-3 py-4"><div className="skeleton h-4 w-40" /></td>
                        <td className="px-3 py-4 hidden md:table-cell"><div className="skeleton h-4 w-24" /></td>
                        <td className="px-3 py-4 hidden sm:table-cell"><div className="skeleton h-4 w-28" /></td>
                        <td className="px-3 py-4 hidden lg:table-cell"><div className="skeleton h-4 w-16" /></td>
                        <td className="px-3 py-4" />
                      </tr>
                    ))
                  ) : dashboards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-slate-600">
                        <LayoutDashboard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No dashboards yet</p>
                        <p className="text-xs mt-1 text-slate-700">Create your first dashboard to get started</p>
                      </td>
                    </tr>
                  ) : (
                    dashboards.map(d => {
                      const isFav = me ? (d.favorited_by || []).includes(me.id) : false
                      const canManage = isAdmin || (me && d.owner_id === me.id)
                      return (
                        <tr key={d.id} className="group hover:bg-white/[0.03] transition-colors duration-150">
                          <td className="pl-5 pr-3 py-3.5">
                            <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} className="accent-sky-500" />
                          </td>
                          <td className="px-2 py-3.5">
                            <button
                              onClick={() => toggleFavorite(d)}
                              title={isFav ? 'Remove favorite' : 'Favorite (max 10)'}
                              className={isFav ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400 transition-colors'}>
                              <Star className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td className="px-3 py-3.5">
                            <Link href={`/dashboards/${d.id}`} className="text-white hover:text-sky-300 transition-colors font-medium">
                              {d.name}
                            </Link>
                            {defaultId === d.id && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-sky-500/15 border border-sky-500/25 text-sky-300">Default</span>
                            )}
                            {d.description && <p className="text-xs text-slate-600 mt-0.5 truncate max-w-xs">{d.description}</p>}
                          </td>
                          <td className="px-3 py-3.5 text-slate-400 hidden md:table-cell">{d.owner?.full_name || d.owner?.email || '—'}</td>
                          <td className="px-3 py-3.5 hidden sm:table-cell"><AccessBadge access={d.access} /></td>
                          <td className="px-3 py-3.5 text-slate-500 text-xs hidden lg:table-cell">{timeAgo(d.updated_at)}</td>
                          <td className="px-3 py-3.5 relative">
                            <button
                              onClick={() => setMenuOpen(menuOpen === d.id ? null : d.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpen === d.id && (
                              <div ref={menuRef} className="absolute right-3 top-11 z-40 w-52 rounded-xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1.5">
                                <Link href={`/dashboards/${d.id}`} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                                  <ExternalLink className="h-3.5 w-3.5" /> Open
                                </Link>
                                <button onClick={() => clone(d)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                                  <Copy className="h-3.5 w-3.5" /> Clone
                                </button>
                                <button onClick={() => { setDetailsFor(d); setMenuOpen(null) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                                  <Info className="h-3.5 w-3.5" /> Details
                                </button>
                                <button onClick={() => { setActivityFor(d); setMenuOpen(null) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                                  <History className="h-3.5 w-3.5" /> Activity log
                                </button>
                                <button onClick={() => setAsDefault(d, defaultId !== d.id)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                                  <CheckCircle className="h-3.5 w-3.5" /> {defaultId === d.id ? 'Remove as default' : 'Set as default'}
                                </button>
                                {canManage && (
                                  <button onClick={() => { setDeleteFor([d]); setMenuOpen(null) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-300 hover:bg-rose-500/10 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Restore deleted */}
          {isAdmin && (
            <div className="mt-4">
              <button onClick={loadDeleted} className="text-xs text-slate-500 hover:text-sky-300 transition-colors inline-flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Restore deleted dashboards
              </button>
            </div>
          )}
        </>
      )}

      {/* Create panel */}
      {showCreate && (
        <CreatePanel
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => { setShowCreate(false); router.push(`/dashboards/${id}`) }}
        />
      )}

      {/* Details panel */}
      {detailsFor && me && (
        <DetailsPanel
          dashboard={detailsFor}
          canManage={isAdmin || detailsFor.owner_id === me.id}
          onClose={() => setDetailsFor(null)}
          onSaved={async () => { setDetailsFor(null); await load() }}
        />
      )}

      {/* Activity modal */}
      {activityFor && <ActivityModal dashboard={activityFor} onClose={() => setActivityFor(null)} />}

      {/* Delete confirm */}
      {deleteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteFor(null)}>
          <div className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25">
                <Trash2 className="h-4 w-4 text-rose-400" />
              </div>
              <h2 className="font-semibold text-white">Delete {deleteFor.length === 1 ? `"${deleteFor[0].name}"` : `${deleteFor.length} dashboards`}?</h2>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              Deleted dashboards can be restored by an admin for 14 days, after which they are gone for good.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteFor(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 border border-white/[0.1] hover:bg-white/[0.06] transition-colors">Cancel</button>
              <button onClick={() => doDelete(deleteFor)} className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Deleted dashboards modal */}
      {showDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowDeleted(false)}>
          <div className="glass-card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2"><RotateCcw className="h-4 w-4 text-sky-400" /> Deleted dashboards (last 14 days)</h2>
              <button onClick={() => setShowDeleted(false)} className="text-slate-500 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
            {deletedRows === null ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
            ) : deletedRows.length === 0 ? (
              <p className="text-sm text-slate-600 py-6 text-center">No recently deleted dashboards</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {deletedRows.map(d => (
                  <div key={d.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{d.name}</p>
                      <p className="text-xs text-slate-600">Deleted {d.deleted_at ? timeAgo(d.deleted_at) : ''} · {d.owner?.full_name || '—'}</p>
                    </div>
                    <button onClick={() => restore(d)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 transition-colors">
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Create dashboard right panel ---
function CreatePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [template, setTemplate] = useState('blank')
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [access, setAccess] = useState('everyone_edit')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const tpl = TEMPLATES.find(t => t.id === template)!

  const pickTemplate = (id: string) => {
    setTemplate(id)
    const t = TEMPLATES.find(x => x.id === id)!
    setIncluded(Object.fromEntries(t.widgets.map(w => [w.type, true])))
  }

  const create = async () => {
    setErr(null)
    setSaving(true)
    try {
      const widget_types = tpl.widgets.filter(w => included[w.type] !== false).map(w => w.type)
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined, access, template, widget_types }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data?.error || 'Failed to create dashboard'); return }
      onCreated(data.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full glass-card rounded-none overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-white text-lg">Create dashboard</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Template</p>
        <div className="space-y-2 mb-6">
          {TEMPLATES.map(t => (
            <div key={t.id}
              onClick={() => pickTemplate(t.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${template === t.id ? 'border-sky-500/50 bg-sky-500/[0.08]' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'}`}>
              <p className="text-sm font-medium text-white">{t.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
              {template === t.id && t.widgets.length > 0 && (
                <div className="mt-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                  {t.widgets.map(w => (
                    <label key={w.type} className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={included[w.type] !== false}
                        onChange={e => setIncluded(prev => ({ ...prev, [w.type]: e.target.checked }))}
                        className="accent-sky-500"
                      />
                      {w.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Name</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Q3 Marketing Overview"
          className="w-full mb-1 px-3.5 py-2.5 text-sm bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        />
        <p className="text-[11px] text-slate-600 mb-5">Names cannot contain URLs or periods.</p>

        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Description (optional)</p>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full mb-5 px-3.5 py-2.5 text-sm bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        />

        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Who can access</p>
        <div className="space-y-2 mb-6">
          {[
            { value: 'private', label: 'Private to owner', sub: 'Only you and admins can see it' },
            { value: 'everyone_view', label: 'Everyone can view', sub: 'Teammates can view but not edit' },
            { value: 'everyone_edit', label: 'Everyone can view & edit', sub: 'Any teammate can change widgets' },
          ].map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${access === opt.value ? 'border-sky-500/50 bg-sky-500/[0.08]' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'}`}>
              <input type="radio" name="access" value={opt.value} checked={access === opt.value} onChange={() => setAccess(opt.value)} className="mt-0.5 accent-sky-500" />
              <span>
                <span className="block text-sm text-white">{opt.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{opt.sub}</span>
              </span>
            </label>
          ))}
        </div>

        {err && <p className="text-sm text-rose-400 mb-3">{err}</p>}

        <button
          onClick={create}
          disabled={saving || !name.trim()}
          className="btn-brand w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
          {saving ? 'Creating…' : 'Create dashboard'}
        </button>
      </div>
    </div>
  )
}

// --- Details right panel (rename / description / owner) ---
function DetailsPanel({ dashboard, canManage, onClose, onSaved }: {
  dashboard: DashboardRow
  canManage: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(dashboard.name)
  const [description, setDescription] = useState(dashboard.description || '')
  const [ownerId, setOwnerId] = useState(dashboard.owner_id || '')
  const [team, setTeam] = useState<TeamMember[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (canManage) {
      fetch('/api/team').then(r => r.json()).then(d => { if (Array.isArray(d)) setTeam(d) }).catch(() => {})
    }
  }, [canManage])

  const save = async () => {
    setErr(null)
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (name !== dashboard.name) body.name = name
      if (description !== (dashboard.description || '')) body.description = description
      if (canManage && ownerId && ownerId !== dashboard.owner_id) body.owner_id = ownerId
      if (Object.keys(body).length === 0) { onClose(); return }
      const res = await fetch(`/api/dashboards/${dashboard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data?.error || 'Failed to save'); return }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full glass-card rounded-none overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-white text-lg">Dashboard details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Name</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full mb-5 px-3.5 py-2.5 text-sm bg-white/[0.06] border border-white/[0.12] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        />

        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Description</p>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full mb-5 px-3.5 py-2.5 text-sm bg-white/[0.06] border border-white/[0.12] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        />

        {canManage && (
          <>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Owner</p>
            <select
              value={ownerId}
              onChange={e => setOwnerId(e.target.value)}
              className="w-full mb-5 px-3.5 py-2.5 text-sm bg-white/[0.06] border border-white/[0.12] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              {!ownerId && <option value="">—</option>}
              {team.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-900">{u.full_name || u.email}</option>
              ))}
            </select>
          </>
        )}

        <div className="text-xs text-slate-600 space-y-1 mb-6">
          <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Created {timeAgo(dashboard.created_at)} · Updated {timeAgo(dashboard.updated_at)}</p>
          <p>{(dashboard.widgets || []).length} widget{(dashboard.widgets || []).length === 1 ? '' : 's'}</p>
        </div>

        {err && <p className="text-sm text-rose-400 mb-3">{err}</p>}

        <button onClick={save} disabled={saving || !name.trim()} className="btn-brand w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// --- Activity log modal ---
function ActivityModal({ dashboard, onClose }: { dashboard: DashboardRow; onClose: () => void }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)

  useEffect(() => {
    fetch(`/api/dashboards/${dashboard.id}/activity`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
  }, [dashboard.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2"><History className="h-4 w-4 text-sky-400" /> Activity — {dashboard.name}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>
        {rows === null ? (
          <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-600 py-6 text-center">No activity recorded yet</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {rows.map(row => (
              <div key={row.id} className="py-3 flex items-start gap-3">
                <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/[0.05] border border-white/[0.08] text-slate-400 shrink-0">
                  {row.action.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300">{row.detail || row.action}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {row.user?.full_name || row.user?.email || 'Unknown user'} · {timeAgo(row.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardsPage() {
  return (
    <Suspense fallback={<div className="p-8 min-h-screen" />}>
      <DashboardsManager />
    </Suspense>
  )
}
