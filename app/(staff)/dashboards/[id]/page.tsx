'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, X, GripVertical, Pencil, Check, Users, DollarSign,
  AlertCircle, CheckCircle, Activity, FileText, Magnet,
  BarChart2, LayoutDashboard, Lock, Eye, AlertTriangle, Clock,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Widget {
  id: string
  type: string
  title: string
  config: Record<string, any>
}

interface Dashboard {
  id: string
  name: string
  description: string | null
  owner_id: string | null
  access: 'private' | 'everyone_view' | 'everyone_edit'
  widgets: Widget[]
  updated_at: string
  owner?: { id: string; full_name: string | null; email: string | null } | null
  can_edit?: boolean
  can_manage?: boolean
}

const WIDGET_LIBRARY: { type: string; label: string; description: string; icon: React.ElementType; defaultConfig?: Record<string, any> }[] = [
  { type: 'stats_tile', label: 'Stat tile', description: 'A single key metric (MRR, clients, invoices)', icon: BarChart2, defaultConfig: { metric: 'total_mrr' } },
  { type: 'activity_feed', label: 'Activity feed', description: 'Latest activity across the workspace', icon: Activity },
  { type: 'top_clients', label: 'Top clients', description: 'Clients ranked by MRR', icon: Users },
  { type: 'leads_pipeline', label: 'Leads pipeline', description: 'Lead counts per pipeline stage', icon: Magnet },
  { type: 'invoice_status', label: 'Invoice status', description: 'Invoice counts grouped by status', icon: FileText },
]

const STAT_METRICS: Record<string, { label: string; icon: React.ElementType; format: 'number' | 'currency'; cls: string }> = {
  active_clients:          { label: 'Active Clients',       icon: Users,       format: 'number',   cls: 'text-sky-400 bg-sky-500/15 border-sky-500/20' },
  total_mrr:               { label: 'Total MRR',            icon: DollarSign,  format: 'currency', cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' },
  invoices_outstanding:    { label: 'Invoices Outstanding', icon: AlertCircle, format: 'currency', cls: 'text-amber-400 bg-amber-500/15 border-amber-500/20' },
  invoices_paid_this_month:{ label: 'Paid This Month',      icon: CheckCircle, format: 'currency', cls: 'text-violet-400 bg-violet-500/15 border-violet-500/20' },
}

const LEAD_STAGES = [
  { key: 'prospect', label: 'Prospect', cls: 'text-sky-300' },
  { key: 'contacted', label: 'Contacted', cls: 'text-amber-300' },
  { key: 'proposal_sent', label: 'Proposal Sent', cls: 'text-violet-300' },
  { key: 'won', label: 'Won', cls: 'text-emerald-300' },
  { key: 'lost', label: 'Lost', cls: 'text-rose-300' },
]

const INVOICE_STATUSES = [
  { key: 'draft', label: 'Draft', cls: 'text-slate-300' },
  { key: 'sent', label: 'Sent', cls: 'text-sky-300' },
  { key: 'paid', label: 'Paid', cls: 'text-emerald-300' },
  { key: 'overdue', label: 'Overdue', cls: 'text-rose-300' },
  { key: 'voided', label: 'Voided', cls: 'text-slate-500' },
]

const ACCESS_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  private:       { label: 'Private',           icon: Lock,   cls: 'bg-amber-500/10 border-amber-500/25 text-amber-300' },
  everyone_view: { label: 'Everyone can view', icon: Eye,    cls: 'bg-sky-500/10 border-sky-500/25 text-sky-300' },
  everyone_edit: { label: 'Everyone can edit', icon: Pencil, cls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' },
}

function fmtCurrency(val: number) {
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// --- Widget body renderers (each fetches its own API) ---

function StatsTileWidget({ config }: { config: Record<string, any> }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    fetch('/api/dashboard/stats').then(r => r.json()).then(d => setStats(d && !d.error ? d : {})).catch(() => setStats({}))
  }, [])
  const metric = STAT_METRICS[config?.metric] ? config.metric : 'total_mrr'
  const meta = STAT_METRICS[metric]
  const raw = stats?.[metric]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-4 py-2">
      <div className={`p-3 rounded-xl border ${meta.cls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{meta.label}</p>
        {stats === null
          ? <div className="skeleton h-8 w-20" />
          : <p className="text-3xl font-bold text-white">{meta.format === 'currency' ? fmtCurrency(raw || 0) : String(raw ?? 0)}</p>}
      </div>
    </div>
  )
}

function ActivityFeedWidget() {
  const [items, setItems] = useState<any[] | null>(null)
  useEffect(() => {
    fetch('/api/dashboard/activity').then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]))
  }, [])
  if (items === null) return <WidgetSkeleton />
  if (items.length === 0) return <WidgetEmpty label="No activity yet" />
  return (
    <div className="space-y-1">
      {items.slice(0, 6).map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/[0.04] transition-colors duration-150">
          <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] shrink-0">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <span className="text-sm text-slate-300 flex-1 truncate">{item.label}</span>
          <span className="text-xs text-slate-700 shrink-0">{timeAgo(item.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

function TopClientsWidget() {
  const [clients, setClients] = useState<any[] | null>(null)
  useEffect(() => {
    fetch('/api/clients?limit=100')
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d?.clients) ? d.clients : []))
      .catch(() => setClients([]))
  }, [])
  if (clients === null) return <WidgetSkeleton />
  const mrr = (c: any) => (c.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(String(p.price || 0)) || 0), 0)
  const top = [...clients].sort((a, b) => mrr(b) - mrr(a)).slice(0, 5)
  if (top.length === 0) return <WidgetEmpty label="No clients yet" />
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-white/[0.04]">
        {top.map((c, i) => (
          <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
            <td className="py-2.5 pr-3 text-slate-600 font-medium w-6">{i + 1}</td>
            <td className="py-2.5 pr-3">
              <Link href={`/clients/${c.id}`} className="text-white hover:text-sky-300 transition-colors font-medium">{c.company_name}</Link>
            </td>
            <td className="py-2.5 text-right"><span className="text-emerald-400 font-semibold">{fmtCurrency(mrr(c))}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LeadsPipelineWidget() {
  const [leads, setLeads] = useState<any[] | null>(null)
  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => setLeads([]))
  }, [])
  if (leads === null) return <WidgetSkeleton />
  const counts: Record<string, number> = {}
  for (const l of leads) counts[l.stage] = (counts[l.stage] || 0) + 1
  const max = Math.max(1, ...LEAD_STAGES.map(s => counts[s.key] || 0))
  return (
    <div className="space-y-2.5">
      {LEAD_STAGES.map(s => (
        <div key={s.key} className="flex items-center gap-3">
          <span className={`text-xs font-medium w-28 shrink-0 ${s.cls}`}>{s.label}</span>
          <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500" style={{ width: `${((counts[s.key] || 0) / max) * 100}%` }} />
          </div>
          <span className="text-sm text-white font-semibold w-8 text-right">{counts[s.key] || 0}</span>
        </div>
      ))}
    </div>
  )
}

function InvoiceStatusWidget() {
  const [invoices, setInvoices] = useState<any[] | null>(null)
  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => setInvoices([]))
  }, [])
  if (invoices === null) return <WidgetSkeleton />
  const counts: Record<string, number> = {}
  for (const inv of invoices) counts[inv.status] = (counts[inv.status] || 0) + 1
  const max = Math.max(1, ...INVOICE_STATUSES.map(s => counts[s.key] || 0))
  return (
    <div className="space-y-2.5">
      {INVOICE_STATUSES.map(s => (
        <div key={s.key} className="flex items-center gap-3">
          <span className={`text-xs font-medium w-24 shrink-0 ${s.cls}`}>{s.label}</span>
          <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${((counts[s.key] || 0) / max) * 100}%` }} />
          </div>
          <span className="text-sm text-white font-semibold w-8 text-right">{counts[s.key] || 0}</span>
        </div>
      ))}
    </div>
  )
}

function WidgetSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-5 w-full" />)}
    </div>
  )
}

function WidgetEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-600">
      <Clock className="h-6 w-6 opacity-30 mb-2" />
      <p className="text-xs">{label}</p>
    </div>
  )
}

function WidgetBody({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'stats_tile': return <StatsTileWidget config={widget.config} />
    case 'activity_feed': return <ActivityFeedWidget />
    case 'top_clients': return <TopClientsWidget />
    case 'leads_pipeline': return <LeadsPipelineWidget />
    case 'invoice_status': return <InvoiceStatusWidget />
    default: return <WidgetEmpty label={`Unknown widget type "${widget.type}"`} />
  }
}

// --- Sortable widget card ---
function SortableWidget({ widget, editMode, onRemove, onRename, onConfigChange }: {
  widget: Widget
  editMode: boolean
  onRemove: () => void
  onRename: (title: string) => void
  onConfigChange: (config: Record<string, any>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled: !editMode })
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(widget.title)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const commitRename = () => {
    setRenaming(false)
    if (title.trim() && title.trim() !== widget.title) onRename(title.trim())
    else setTitle(widget.title)
  }

  return (
    <div ref={setNodeRef} style={style} className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        {editMode && (
          <button {...listeners} {...attributes}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none p-0.5"
            title="Drag to reorder">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setTitle(widget.title); setRenaming(false) } }}
            className="flex-1 px-2 py-1 text-sm font-semibold bg-white/[0.06] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
        ) : (
          <h2 className="font-semibold text-white flex-1 truncate">{widget.title}</h2>
        )}
        {editMode && !renaming && (
          <>
            {widget.type === 'stats_tile' && (
              <select
                value={STAT_METRICS[widget.config?.metric] ? widget.config.metric : 'total_mrr'}
                onChange={e => onConfigChange({ ...widget.config, metric: e.target.value })}
                className="text-xs bg-white/[0.06] border border-white/[0.12] rounded-lg text-slate-300 px-2 py-1 focus:outline-none">
                {Object.entries(STAT_METRICS).map(([key, m]) => (
                  <option key={key} value={key} className="bg-slate-900">{m.label}</option>
                ))}
              </select>
            )}
            <button onClick={() => setRenaming(true)} title="Rename widget" className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onRemove} title="Remove widget" className="p-1 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <WidgetBody widget={widget} />
    </div>
  )
}

export default function DashboardDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [accessMenu, setAccessMenu] = useState(false)
  const accessRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/dashboards/${id}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (data?.__unavailable) { setUnavailable(true); return }
        if (!ok) { setError(data?.error || 'Failed to load dashboard'); return }
        setDashboard(data)
        setWidgets(Array.isArray(data.widgets) ? data.widgets : [])
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (accessRef.current && !accessRef.current.contains(e.target as Node)) setAccessMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setWidgets(prev => {
        const oldIndex = prev.findIndex(w => w.id === String(active.id))
        const newIndex = prev.findIndex(w => w.id === String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
      setDirty(true)
    }
  }, [])

  const addWidget = (type: string) => {
    const def = WIDGET_LIBRARY.find(w => w.type === type)!
    setWidgets(prev => [...prev, {
      id: (globalThis.crypto?.randomUUID?.() || `w_${Date.now()}_${Math.random().toString(36).slice(2)}`),
      type,
      title: def.label,
      config: { ...(def.defaultConfig || {}) },
    }])
    setDirty(true)
    setShowPicker(false)
  }

  const save = async () => {
    if (!dashboard) return
    setSaving(true)
    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data?.error || 'Failed to save'); return }
      setDashboard(prev => prev ? { ...prev, widgets: data.widgets, updated_at: data.updated_at } : prev)
      setWidgets(Array.isArray(data.widgets) ? data.widgets : widgets)
      setDirty(false)
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  const changeAccess = async (access: string) => {
    if (!dashboard) return
    setAccessMenu(false)
    const res = await fetch(`/api/dashboards/${dashboard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data?.error || 'Failed to change access'); return }
    setDashboard(prev => prev ? { ...prev, access: data.access } : prev)
  }

  if (loading) {
    return (
      <div className="p-5 lg:p-8 min-h-screen">
        <div className="skeleton h-8 w-64 mb-8" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-48 w-full rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (unavailable || error || !dashboard) {
    return (
      <div className="p-5 lg:p-8 min-h-screen">
        <Link href="/dashboards?manage=1" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-300 transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> All dashboards
        </Link>
        <div className="glass-card p-10 text-center text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{unavailable ? 'Dashboards are not set up yet in this environment.' : (error || 'Dashboard not found')}</p>
        </div>
      </div>
    )
  }

  const accessMeta = ACCESS_META[dashboard.access] || ACCESS_META.everyone_edit
  const AccessIcon = accessMeta.icon

  return (
    <div className="p-5 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-8 animate-float-up">
        <div className="min-w-0">
          <Link href="/dashboards?manage=1" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-300 transition-colors mb-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> All dashboards
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{dashboard.name}</h1>
            {/* Access badge — HubSpot "Assigned" pattern: click to change if owner/admin */}
            <div className="relative" ref={accessRef}>
              <button
                onClick={() => dashboard.can_manage && setAccessMenu(v => !v)}
                title={dashboard.can_manage ? 'Change who can access' : undefined}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${accessMeta.cls} ${dashboard.can_manage ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}>
                <AccessIcon className="h-3 w-3" />
                {accessMeta.label}
              </button>
              {accessMenu && (
                <div className="absolute left-0 top-8 z-40 w-56 rounded-xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1.5">
                  {Object.entries(ACCESS_META).map(([value, meta]) => {
                    const Icon = meta.icon
                    return (
                      <button key={value} onClick={() => changeAccess(value)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                        {dashboard.access === value && <Check className="h-3.5 w-3.5 text-sky-400 ml-auto" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            {dashboard.description || `Owned by ${dashboard.owner?.full_name || dashboard.owner?.email || '—'}`} · Updated {timeAgo(dashboard.updated_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-slate-300 border border-white/[0.1] hover:bg-white/[0.06] transition-colors">
                <Plus className="h-4 w-4" /> Add widget
              </button>
              <button
                onClick={() => { setWidgets(Array.isArray(dashboard.widgets) ? dashboard.widgets : []); setDirty(false); setEditMode(false) }}
                className="px-3.5 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !dirty} className="btn-brand flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : dashboard.can_edit ? (
            <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-slate-300 border border-white/[0.1] hover:bg-white/[0.06] transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Edit dashboard
            </button>
          ) : null}
        </div>
      </div>

      {/* Widget grid */}
      {widgets.length === 0 ? (
        <div className="glass-card p-14 text-center text-slate-600">
          <LayoutDashboard className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">This dashboard has no widgets yet</p>
          {dashboard.can_edit && (
            <button
              onClick={() => { setEditMode(true); setShowPicker(true) }}
              className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm mt-4">
              <Plus className="h-4 w-4" /> Add your first widget
            </button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
            <div className="grid md:grid-cols-2 gap-4">
              {widgets.map(w => (
                <SortableWidget
                  key={w.id}
                  widget={w}
                  editMode={editMode}
                  onRemove={() => { setWidgets(prev => prev.filter(x => x.id !== w.id)); setDirty(true) }}
                  onRename={(title) => { setWidgets(prev => prev.map(x => x.id === w.id ? { ...x, title } : x)); setDirty(true) }}
                  onConfigChange={(config) => { setWidgets(prev => prev.map(x => x.id === w.id ? { ...x, config } : x)); setDirty(true) }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add widget picker */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPicker(false)}>
          <div className="glass-card p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Add widget</h2>
              <button onClick={() => setShowPicker(false)} className="text-slate-500 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {WIDGET_LIBRARY.map(w => {
                const Icon = w.icon
                return (
                  <button key={w.type} onClick={() => addWidget(w.type)}
                    className="flex flex-col items-start gap-2.5 p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-sky-500/30 transition-all duration-200 text-left">
                    <div className="p-2 rounded-xl border bg-sky-500/10 border-sky-500/20 text-sky-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{w.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
