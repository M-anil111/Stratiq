'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, DollarSign, FileText, Calendar, Plus, X, Trash2,
  ExternalLink, Briefcase, AlertTriangle, Building2,
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
}
const DEFAULT_STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'cancelled', 'prospect', 'in_onboarding']
const selectClass = 'bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

function fmt(n: number | null | undefined) {
  if (n == null) return '$0.00'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Project {
  id: string
  name: string | null
  domain: string | null
  status: string
  client_id: string | null
  client?: { id: string; company_name: string; website?: string } | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  revenue: number
  invoice_count: number
}
interface Invoice {
  id: string
  invoice_number: string | null
  status: string
  issue_date: string
  due_date: string | null
  total: number
  amount_paid: number
  client_id: string
  project_id?: string | null
  client?: { company_name: string }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  // Status option list: default to the hardcoded list, then replace with
  // org-managed Masters data (Settings → Masters, category "project_status")
  // if any is configured. We use the master's `value` (not `label`) so the
  // option values keep matching the exact strings STATUS_COLORS and other
  // status === 'active' style checks expect elsewhere in the app.
  const [STATUS_OPTIONS, setStatusOptions] = useState<string[]>(DEFAULT_STATUS_OPTIONS)

  useEffect(() => {
    fetch('/api/settings/masters?category=project_status')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setStatusOptions(data.map((m: any) => m.value).filter(Boolean))
        }
      })
      .catch(() => {})
  }, [])

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    setProject(await res.json())
  }, [projectId])

  const loadInvoices = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/invoices`)
    const data = await res.json()
    setInvoices(data.invoices || [])
    if (data.migrationRequired) setLinkMsg(data.message || '')
  }, [projectId])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadProject(), loadInvoices()])
      setLoading(false)
    })()
  }, [loadProject, loadInvoices])

  const updateStatus = async (status: string) => {
    setSavingStatus(true)
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setProject((p) => (p ? { ...p, status } : p))
    setSavingStatus(false)
  }

  const unlink = async (invoiceId: string) => {
    await fetch(`/api/projects/${projectId}/invoices?invoice_id=${invoiceId}`, { method: 'DELETE' })
    await Promise.all([loadInvoices(), loadProject()])
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded bg-slate-900/[0.04] dark:bg-white/[0.06] animate-pulse" />
        <div className="h-32 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] animate-pulse" />
        <div className="h-64 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] animate-pulse" />
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Link href="/projects" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 mb-4">
          <ArrowLeft size={16} /> Back to projects
        </Link>
        <div className="glass-card p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
          <p className="text-slate-700 dark:text-slate-300 font-medium">Project not found</p>
        </div>
      </div>
    )
  }

  const revenue = project.revenue || 0
  const paid = invoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0)
  const outstanding = Math.max(0, revenue - paid)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/projects" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={16} /> Back to projects
      </Link>

      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
              <Briefcase size={22} className="text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project.name || project.domain || 'Untitled project'}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-600 dark:text-slate-400 flex-wrap">
                {project.domain && <span>{project.domain}</span>}
                {project.client && (
                  <Link href={`/clients/${project.client.id}`} className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-sky-400">
                    <Building2 size={14} /> {project.client.company_name}
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={project.status}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={savingStatus}
              className={`${selectClass} ${STATUS_COLORS[project.status] || ''}`}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s.replace(/_/g, ' ')}</option>)}
            </select>
            {savingStatus && <Loader2 size={16} className="animate-spin text-slate-600 dark:text-slate-400" />}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <InfoTile icon={<Calendar size={14} />} label="Start date" value={fmtDate(project.start_date)} />
          <InfoTile icon={<Calendar size={14} />} label="End date" value={fmtDate(project.end_date)} />
          {project.client && (
            <div className="bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-3 col-span-2">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Client submissions</p>
              <Link href={`/clients/${project.client.id}/projects`} className="text-sm text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 mt-1">
                View per-client projects <ExternalLink size={12} />
              </Link>
            </div>
          )}
        </div>

        {project.notes && (
          <div className="mt-4 text-sm text-slate-700 dark:text-slate-300 bg-slate-900/[0.04] dark:bg-white/[0.03] rounded-xl p-3 whitespace-pre-wrap">{project.notes}</div>
        )}
      </div>

      {/* Financials */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1"><DollarSign size={12} /> Total invoiced</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(revenue)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Paid</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fmt(paid)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{fmt(outstanding)} outstanding</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1"><FileText size={12} /> Invoices</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{invoices.length}</p>
        </div>
      </div>

      {/* Invoices section */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-900/10 dark:border-white/[0.06]">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2"><FileText size={16} className="text-sky-400" /> Invoices</h2>
          <button onClick={() => setShowPicker(true)} className="text-sm text-sky-400 hover:text-sky-300 inline-flex items-center gap-1">
            <Plus size={14} /> Add invoice to project
          </button>
        </div>
        {linkMsg && (
          <div className="px-4 py-3 text-sm text-amber-200 bg-amber-500/10 flex items-center gap-2">
            <AlertTriangle size={14} /> {linkMsg}
          </div>
        )}
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No invoices linked to this project yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase tracking-wider border-b border-slate-900/10 dark:border-white/[0.06]">
                  <th className="px-4 py-2 font-medium">Invoice</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Issued</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium text-right">Paid</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-900/10 dark:border-white/[0.04] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-2">
                      <Link href={`/invoices`} className="text-slate-900 dark:text-white hover:text-sky-400 font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</Link>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{inv.status}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs">{fmtDate(inv.issue_date)}</td>
                    <td className="px-4 py-2 text-right text-slate-200">{fmt(inv.total)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(inv.amount_paid)}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => unlink(inv.id)} title="Unlink" className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPicker && (
        <InvoicePicker
          projectId={projectId}
          onClose={() => setShowPicker(false)}
          onLinked={async () => { await Promise.all([loadInvoices(), loadProject()]) }}
        />
      )}
    </div>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-3">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">{icon} {label}</p>
      <p className="text-sm text-slate-200 mt-1">{value}</p>
    </div>
  )
}

function InvoicePicker({ projectId, onClose, onLinked }: { projectId: string; onClose: () => void; onLinked: () => Promise<void> }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((d) => {
        const list: Invoice[] = Array.isArray(d) ? d : []
        // Only org invoices not already linked to a project.
        setInvoices(list.filter((i) => !i.project_id))
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }, [])

  const link = async (invoiceId: string) => {
    setLinking(invoiceId)
    await fetch(`/api/projects/${projectId}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId))
    await onLinked()
    setLinking(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add invoice to project</h2>
          <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20} /></button>
        </div>
        {loading ? (
          <div className="py-8 text-center"><Loader2 size={20} className="animate-spin text-slate-600 dark:text-slate-400 mx-auto" /></div>
        ) : invoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No unlinked invoices available.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{inv.client?.company_name || ''} · {fmt(inv.total)} · {inv.status}</p>
                </div>
                <button onClick={() => link(inv.id)} disabled={linking === inv.id} className="text-sm text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 disabled:opacity-50">
                  {linking === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
