'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, Briefcase, Loader2, X, ExternalLink, DollarSign, FileText, Calendar, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import AddButton from '@/components/ui/AddButton'

interface ClientLite { id: string; company_name: string; website?: string }
interface Project {
  id: string
  name: string | null
  domain: string | null
  status: string
  client_id: string | null
  client?: { id: string; company_name: string; website?: string } | null
  start_date: string | null
  end_date: string | null
  revenue: number
  invoice_count: number
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
}

const STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'cancelled', 'prospect', 'in_onboarding']

const selectClass = 'bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

function fmt(n: number | null | undefined) {
  if (n == null) return '$0'
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{(status || '').replace(/_/g, ' ')}</span>
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<ClientLite[]>([])
  const [loading, setLoading] = useState(true)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (clientFilter) params.set('client_id', clientFilter)
    if (search) params.set('search', search)
    try {
      const res = await fetch(`/api/projects?${params.toString()}`)
      const data = await res.json()
      setProjects(data.projects || [])
      setMigrationRequired(!!data.migrationRequired)
    } catch {
      setProjects([])
    }
    setLoading(false)
  }, [statusFilter, clientFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/clients?limit=500')
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => setClients([]))
  }, [])

  const totalRevenue = projects.reduce((s, p) => s + (p.revenue || 0), 0)
  const totalInvoices = projects.reduce((s, p) => s + (p.invoice_count || 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase size={24} className="text-sky-400" /> Projects
          </h1>
          <p className="text-sm text-slate-400 mt-1">Track projects, assign clients, and see project financials.</p>
        </div>
        <AddButton label="New Project" onClick={() => setShowModal(true)} />
      </div>

      {migrationRequired && (
        <div className="glass-card p-4 mb-6 flex items-start gap-3 border border-amber-500/30">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            The projects table or its financial columns are not available yet. Apply migration
            <code className="mx-1 px-1.5 py-0.5 rounded bg-black/30 text-amber-100">028_project_financials.sql</code>
            to enable this module.
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Projects</p>
          <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Associated Revenue</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totalRevenue)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Linked Invoices</p>
          <p className="text-2xl font-bold text-white mt-1">{totalInvoices}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, domains, clients…"
            className={`${selectClass} pl-9 w-full`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selectClass}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium">No projects yet</p>
            <p className="text-sm text-slate-500 mt-1">Create your first project to start tracking financials.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                  <th className="px-4 py-3 font-medium text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="font-medium text-white hover:text-sky-400 transition-colors">
                        {p.name || p.domain || 'Untitled project'}
                      </Link>
                      {p.name && p.domain && <p className="text-xs text-slate-500">{p.domain}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.client ? (
                        <Link href={`/clients/${p.client.id}`} className="text-slate-300 hover:text-sky-400 inline-flex items-center gap-1">
                          {p.client.company_name} <ExternalLink size={12} />
                        </Link>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">{fmt(p.revenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{p.invoice_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <NewProjectModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function NewProjectModal({ clients, onClose, onCreated }: { clients: ClientLite[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', client_id: '', status: 'active', domain: '', start_date: '', end_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.client_id) { setError('Please select a client.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to create project.')
        setSaving(false)
        return
      }
      onCreated()
    } catch {
      setError('Failed to create project.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Project name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-glass w-full" placeholder="e.g. Website Redesign" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Client *</label>
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={`${selectClass} w-full`}>
              <option value="">Select a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={`${selectClass} w-full`}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Domain</label>
              <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="input-glass w-full" placeholder="(defaults to client website)" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Start date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={`${selectClass} w-full`} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">End date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={`${selectClass} w-full`} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input-glass w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-brand inline-flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={16} className="animate-spin" />} Create Project
          </button>
        </div>
      </div>
    </div>
  )
}
