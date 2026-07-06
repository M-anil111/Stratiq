'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Plus, Search, Users, Globe, Mail, Phone, MapPin, ExternalLink,
  ChevronRight, Edit2, FileText, Loader2, X, Star, TrendingUp,
  DollarSign, Briefcase, Calendar, Award, CreditCard, Wrench,
  ChevronDown, ClipboardList, MessageSquare, PhoneCall,
  Download, CheckSquare, Square,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { downloadCsv } from '@/lib/csv'

const BULK_STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Onboarding', value: 'in_onboarding' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30',
  hold: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30',
  on_hold: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30',
  completed: 'bg-slate-500/15 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/30',
  onboarding: 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/30',
  in_onboarding: 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/30',
  prospect: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/30',
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400',
  hold: 'bg-amber-400',
  on_hold: 'bg-amber-400',
  cancelled: 'bg-red-400',
  completed: 'bg-slate-400',
  onboarding: 'bg-violet-400',
  in_onboarding: 'bg-violet-400',
  prospect: 'bg-blue-400',
}

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Onboarding', value: 'in_onboarding' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'On Hold', value: 'on_hold' },
]

const DEGREE_COLOR: Record<string, string> = {
  vip: 'text-amber-400',
  important: 'text-sky-400',
  regular: 'text-slate-700 dark:text-slate-300',
  inactive: 'text-slate-500',
}

const CREDIT_COLOR: Record<string, string> = {
  good: 'text-emerald-400',
  average: 'text-amber-400',
  poor: 'text-red-400',
}

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function AvatarBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  const color = colors[(name || '?').charCodeAt(0) % colors.length]
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} ${color} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {initials(name || '?')}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-900/10 dark:border-white/[0.04] last:border-0">
      <span className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-200 flex-1">{value || '—'}</span>
    </div>
  )
}

function StatTile({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-4 flex flex-col gap-1 ${className}`}>
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <div>{children}</div>
    </div>
  )
}

function formatYear(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).getFullYear().toString()
}

function yearsAgo(dateStr: string | null | undefined) {
  if (!dateStr) return ''
  const yrs = new Date().getFullYear() - new Date(dateStr).getFullYear()
  return yrs > 0 ? `${yrs}+ Yrs` : 'This Year'
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [client, setClient] = useState<any>(null)
  const [clientLoading, setClientLoading] = useState(false)
  const [activeProjectIdx, setActiveProjectIdx] = useState(0)
  const [activeServiceTab, setActiveServiceTab] = useState<'active' | 'expired'>('active')
  const [sortBy, setSortBy] = useState<'name' | 'mrr' | 'status'>('name')
  const [showNewMenu, setShowNewMenu] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<NodeJS.Timeout>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchClients = useCallback((q: string, status: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (q) params.set('search', q)
    if (status) params.set('status', status)
    fetch(`/api/clients?${params}`)
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchClients('', '') }, [fetchClients])

  const onSearch = (q: string) => {
    setSearch(q)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => fetchClients(q, statusFilter), 300)
  }

  const onStatus = (s: string) => {
    setStatusFilter(s)
    fetchClients(search, s)
  }

  const onClientClick = (id: string) => {
    // On mobile the detail pane is hidden — navigate to the full detail page instead.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      router.push(`/clients/${id}`)
      return
    }
    selectClient(id)
  }

  const selectClient = (id: string) => {
    if (selectedId === id) return
    setSelectedId(id)
    setClient(null)
    setActiveProjectIdx(0)
    setClientLoading(true)
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(d => { setClient(d); setClientLoading(false) })
      .catch(() => setClientLoading(false))
  }

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (sortBy === 'mrr') {
        const mrrA = (a.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
        const mrrB = (b.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
        return mrrB - mrrA
      }
      if (sortBy === 'status') {
        return (a.project_status || '').localeCompare(b.project_status || '')
      }
      return (a.company_name || '').localeCompare(b.company_name || '')
    })
  }, [clients, sortBy])

  // Group clients by contact person
  const grouped = useMemo(() => {
    const map = new Map<string, { contactName: string; clients: any[] }>()
    for (const c of sortedClients) {
      const key = [c.contact_first_name, c.contact_last_name].filter(Boolean).join(' ') || c.company_name
      if (!map.has(key)) map.set(key, { contactName: key, clients: [] })
      map.get(key)!.clients.push(c)
    }
    return Array.from(map.values())
  }, [clients])

  const pkgs: any[] = client?.service_packages || []
  const projects: any[] = client?.projects || []
  const monthlyRevenue = pkgs.reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
  const selectedProject = projects[activeProjectIdx]

  const openProjects = projects.filter((p: any) => !['completed', 'cancelled'].includes(p.status)).length
  const closedProjects = projects.filter((p: any) => ['completed', 'cancelled'].includes(p.status)).length

  // Derive a short client ID from UUID
  const clientShortId = client?.id ? 'SC' + client.id.replace(/-/g, '').slice(0, 4).toUpperCase() : '—'

  // ── Bulk selection helpers ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => { setSelectedIds(new Set()); setBulkStatus(''); setBulkMsg('') }
  const allFilteredSelected = sortedClients.length > 0 && sortedClients.every(c => selectedIds.has(c.id))
  const toggleSelectAll = () => {
    if (allFilteredSelected) clearSelection()
    else setSelectedIds(new Set(sortedClients.map(c => c.id)))
  }

  const toCsvRows = (list: any[]) =>
    list.map(c => {
      const mrr = (c.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
      return {
        company_name: c.company_name || '',
        email: c.email || '',
        phone: c.phone || '',
        website: c.website || '',
        city: c.city || '',
        project_status: c.project_status || '',
        mrr,
        active_project_count: c.active_project_count ?? 0,
      }
    })

  const exportAll = () => {
    if (!sortedClients.length) return
    downloadCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows(sortedClients))
  }
  const exportSelected = () => {
    const list = sortedClients.filter(c => selectedIds.has(c.id))
    if (!list.length) return
    downloadCsv(`clients-selected-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows(list))
  }

  const applyBulkStatus = async () => {
    const ids = Array.from(selectedIds)
    if (!bulkStatus || !ids.length || bulkBusy) return
    setBulkBusy(true)
    setBulkMsg('')
    try {
      const res = await fetch('/api/clients/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, project_status: bulkStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setBulkMsg(`Updated ${data.updated ?? ids.length}`)
        fetchClients(search, statusFilter)
        setSelectedIds(new Set())
        setBulkStatus('')
      } else {
        setBulkMsg(data.error || 'Update failed')
      }
    } catch {
      setBulkMsg('Update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const selectedCount = selectedIds.size

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── LEFT SIDEBAR: Client List ── */}
      <div className="w-full lg:w-72 shrink-0 border-r border-slate-900/10 dark:border-white/[0.08] flex flex-col bg-white dark:bg-[#070f1c]">
        <div className="px-4 py-3 border-b border-slate-900/10 dark:border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Client List</h2>
          <div className="flex items-center gap-1.5">
            <button onClick={exportAll} disabled={!sortedClients.length}
              title="Export all (filtered) to CSV"
              className="w-6 h-6 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.05] border border-slate-900/10 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 flex items-center justify-center hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />
            </button>
            <Link href="/clients/new"
              className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center hover:bg-sky-500/30 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-900/10 dark:border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full bg-slate-900/[0.04] dark:bg-white/[0.05] border border-slate-900/10 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-500 rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            />
            {search && (
              <button onClick={() => { setSearch(''); fetchClients('', statusFilter) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status chips */}
        <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-slate-900/10 dark:border-white/[0.06]">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => onStatus(f.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-sky-500 text-white' : 'bg-slate-900/[0.04] dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="px-3 py-1.5 flex items-center gap-1 border-b border-slate-900/10 dark:border-white/[0.06]">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider mr-1">Sort</span>
          {([['name', 'Name'], ['mrr', 'MRR'], ['status', 'Status']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${sortBy === val ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Select all (filtered) */}
        {!loading && sortedClients.length > 0 && (
          <div className="px-3 py-1.5 flex items-center gap-2 border-b border-slate-900/10 dark:border-white/[0.06]">
            <button onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 hover:text-white transition-colors">
              {allFilteredSelected
                ? <CheckSquare className="h-3.5 w-3.5 text-sky-400" />
                : <Square className="h-3.5 w-3.5" />}
              Select all
            </button>
            {selectedCount > 0 && <span className="text-[10px] text-sky-400 ml-auto">{selectedCount} selected</span>}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="px-3 py-2 border-b border-sky-500/20 bg-sky-500/[0.06] flex flex-wrap items-center gap-2">
            <button onClick={exportSelected}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-900/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/[0.1] text-slate-200 hover:bg-white/[0.1] transition-colors">
              <Download className="h-3 w-3" /> Export CSV
            </button>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              className="bg-slate-900/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/[0.1] text-[11px] text-slate-900 dark:text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              <option value="">Change status…</option>
              {BULK_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={applyBulkStatus} disabled={!bulkStatus || bulkBusy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-sky-500 text-white hover:bg-sky-400 transition-colors disabled:opacity-40">
              {bulkBusy ? 'Applying…' : 'Apply'}
            </button>
            <button onClick={clearSelection}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-white transition-colors">
              <X className="h-3 w-3" /> Clear
            </button>
            {bulkMsg && <span className="text-[10px] text-emerald-400 w-full">{bulkMsg}</span>}
          </div>
        )}

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          ) : clients.length === 0 ? (
            search ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">No clients match</div>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.08] flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-slate-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">No clients yet</h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">Add your first client to get started</p>
                <Link href="/clients/new"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition-colors">
                  <Plus className="h-4 w-4" /> Add Client
                </Link>
              </div>
            )
          ) : grouped.map(group => {
            const isMulti = group.clients.length > 1
            return (
              <div key={group.contactName}>
                {/* Contact person header — only show if they have multiple businesses */}
                {isMulti && (
                  <div className="px-3 py-2 flex items-center gap-2 bg-slate-900/[0.04] dark:bg-white/[0.02] border-b border-slate-900/10 dark:border-white/[0.04]">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                      {group.contactName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-violet-300 truncate flex-1">{group.contactName}</span>
                    <span className="text-[10px] text-slate-600">{group.clients.length} biz</span>
                  </div>
                )}
                {group.clients.map(c => {
                  const displayName = c.display_name || c.company_name
                  const mrr = (c.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
                  const isChecked = selectedIds.has(c.id)
                  return (
                    <div key={c.id}
                      className={`w-full border-b border-slate-900/10 dark:border-white/[0.04] transition-colors flex items-center
                        ${selectedId === c.id ? 'bg-sky-500/10 border-l-2 border-l-sky-500' : isChecked ? 'bg-sky-500/[0.05]' : 'hover:bg-white/[0.04]'}`}>
                      <span
                        role="checkbox"
                        aria-checked={isChecked}
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(c.id) }}
                        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleSelect(c.id) } }}
                        className={`shrink-0 flex items-center justify-center cursor-pointer text-slate-500 hover:text-sky-400 ${isMulti ? 'pl-4 pr-1 py-2.5' : 'pl-3 pr-1 py-3'}`}>
                        {isChecked ? <CheckSquare className="h-4 w-4 text-sky-400" /> : <Square className="h-4 w-4" />}
                      </span>
                    <button onClick={() => onClientClick(c.id)}
                      className={`flex-1 min-w-0 text-left transition-colors flex items-center gap-3
                        ${isMulti ? 'pl-1 pr-3 py-2.5' : 'pl-1 pr-3 py-3'}`}>
                      {isMulti && <span className="text-slate-700 text-xs mr-0.5">└</span>}
                      <AvatarBadge name={displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.project_status] || 'bg-slate-500'}`} />
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{displayName}</p>
                          {c.project_status && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border shrink-0 ${STATUS_COLORS[c.project_status] || 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30'}`}>
                              {c.project_status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500 truncate">{c.sales_manager?.full_name || c.industry || '—'}</p>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {(c.active_project_count ?? 0) > 0 && (
                              <span className="text-[10px] text-violet-400">{c.active_project_count}p</span>
                            )}
                            {mrr > 0 && <p className="text-xs text-sky-400">${mrr.toLocaleString()}</p>}
                          </div>
                        </div>
                      </div>
                    </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="px-3 py-2 border-t border-slate-900/10 dark:border-white/[0.06]">
          <p className="text-xs text-slate-600">{clients.length} businesses · {grouped.length} contact{grouped.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── RIGHT PANEL (hidden on mobile — tapping a client navigates to /clients/[id]) ── */}
      <div className="hidden lg:block flex-1 overflow-y-auto bg-white dark:bg-[#080f1e]">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.04] flex items-center justify-center mb-5">
              <Users className="h-10 w-10 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Select a client</h2>
            <p className="text-slate-500 text-sm max-w-xs">Pick a client from the list to view all their details, projects, and services.</p>
          </div>
        ) : clientLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-slate-600 dark:text-slate-400" />
          </div>
        ) : client && !client.error ? (
          <div>
            {/* ── TOP INFO BAR ── */}
            <div className="bg-sky-600/20 border-b border-sky-500/20 px-0">
              <div className="flex items-stretch">
                <div className="flex items-stretch divide-x divide-slate-900/10 dark:divide-white/[0.08] overflow-x-auto flex-1">
                  {[
                    { label: 'Client Since', value: <><span className="text-slate-900 dark:text-white font-bold">{formatYear(client.created_at)}</span><span className="text-sky-300 text-xs ml-1">{yearsAgo(client.created_at)}</span></> },
                    { label: 'Company Name', value: <span className="text-slate-900 dark:text-white font-bold text-sm">{client.company_name}</span> },
                    { label: 'Client ID', value: <span className="text-slate-900 dark:text-white font-bold">{clientShortId}</span> },
                    { label: 'Account Manager', value: <span className="text-slate-900 dark:text-white font-semibold">{client.sales_manager?.full_name || '—'}</span> },
                    { label: 'Contact', value: <a href={`tel:${client.phone}`} className="text-sky-300 hover:text-sky-200 font-medium">{client.phone || '—'}</a> },
                    { label: 'Email', value: <a href={`mailto:${client.email}`} className="text-sky-300 hover:text-sky-200 font-medium truncate block max-w-[140px]">{client.email || '—'}</a> },
                  ].map((col, i) => (
                    <div key={i} className="flex flex-col justify-center px-4 py-3 min-w-fit shrink-0">
                      <p className="text-[10px] text-sky-300/70 uppercase tracking-wider mb-1">{col.label}</p>
                      <div className="text-sm">{col.value}</div>
                    </div>
                  ))}
                </div>
                {/* ── New + split button ── */}
                <div ref={newMenuRef} className="relative flex items-center px-3 border-l border-slate-900/10 dark:border-white/[0.08] shrink-0">
                  <div className="flex rounded-lg overflow-hidden border border-sky-500/40">
                    <Link href={`/clients/${client.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-semibold transition-colors">
                      <Plus className="h-3.5 w-3.5" /> New
                    </Link>
                    <button onClick={() => setShowNewMenu(v => !v)}
                      className="px-1.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 border-l border-sky-500/30 transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {showNewMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-900/10 dark:border-white/[0.12] bg-white dark:bg-[#0d1829] shadow-2xl overflow-hidden">
                      {[
                        { icon: ClipboardList, label: 'Log Activity', href: `/targets?client=${client.id}` },
                        { icon: FileText, label: 'Create Invoice', href: `/clients/${client.id}?tab=invoices` },
                        { icon: MessageSquare, label: 'Add Note', href: `/clients/${client.id}?tab=notes` },
                        { icon: PhoneCall, label: 'Schedule Call', href: `/clients/${client.id}?tab=activity` },
                      ].map(item => (
                        <Link key={item.label} href={item.href}
                          onClick={() => setShowNewMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] text-slate-200 hover:text-white transition-colors text-sm">
                          <item.icon className="h-4 w-4 text-sky-400 shrink-0" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── STATS ROW 1 ── */}
            <div className="px-5 pt-4 pb-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatTile label="Client Priority">
                  <div className="flex items-center gap-2">
                    <Star className={`h-4 w-4 ${DEGREE_COLOR[client.client_degree || 'regular']}`} />
                    <span className={`text-sm font-bold capitalize ${DEGREE_COLOR[client.client_degree || 'regular']}`}>
                      {client.client_degree || 'Regular'}
                    </span>
                  </div>
                </StatTile>

                <StatTile label="Projects">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Open</span>
                      <span className="text-slate-900 dark:text-white font-bold">{openProjects.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Close</span>
                      <span className="text-slate-900 dark:text-white font-bold">{closedProjects.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-900/10 dark:border-white/[0.06] pt-0.5 mt-0.5">
                      <span className="text-slate-600 dark:text-slate-400">Total</span>
                      <span className="text-sky-400 font-bold">{projects.length.toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                </StatTile>

                <StatTile label="Active Services">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-violet-400" />
                    <span className="text-xl font-bold text-slate-900 dark:text-white">{pkgs.length}</span>
                  </div>
                </StatTile>

                <StatTile label="Monthly Revenue">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    <span className="text-lg font-bold text-emerald-400">
                      {monthlyRevenue > 0 ? `$${monthlyRevenue.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  {monthlyRevenue > 0 && <p className="text-[10px] text-slate-500 mt-0.5">/month</p>}
                </StatTile>

                <StatTile label="Revenue Level">
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-4 w-4 ${monthlyRevenue > 5000 ? 'text-emerald-400' : monthlyRevenue > 2000 ? 'text-amber-400' : 'text-slate-600 dark:text-slate-400'}`} />
                    <span className={`text-sm font-bold ${monthlyRevenue > 5000 ? 'text-emerald-400' : monthlyRevenue > 2000 ? 'text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {monthlyRevenue > 5000 ? 'High' : monthlyRevenue > 2000 ? 'Medium' : monthlyRevenue > 0 ? 'Low' : '—'}
                    </span>
                  </div>
                </StatTile>
              </div>
            </div>

            {/* ── STATS ROW 2 ── */}
            <div className="px-5 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatTile label="Service Packages">
                  <div className="flex flex-col gap-0.5 text-xs">
                    {pkgs.slice(0, 3).map((p: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[80px]">{p.service}</span>
                        <span className="text-slate-900 dark:text-white font-medium ml-1">${(parseFloat(p.price) || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    {pkgs.length === 0 && <span className="text-slate-500">None</span>}
                  </div>
                </StatTile>

                <StatTile label="Maint. Since">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xl font-bold text-slate-900 dark:text-white">{client.maint_since || '—'}</span>
                  </div>
                </StatTile>

                <StatTile label="Maint. Degree">
                  <span className={`text-sm font-bold capitalize ${client.maint_degree === 'high' ? 'text-rose-400' : client.maint_degree === 'low' ? 'text-slate-600 dark:text-slate-400' : 'text-amber-400'}`}>
                    {client.maint_degree || 'Medium'}
                  </span>
                </StatTile>

                <StatTile label="Credit">
                  <div className="flex items-center gap-2">
                    <CreditCard className={`h-4 w-4 ${CREDIT_COLOR[client.credit_status || 'good']}`} />
                    <span className={`text-sm font-bold capitalize ${CREDIT_COLOR[client.credit_status || 'good']}`}>
                      {client.credit_status || 'Good'}
                    </span>
                  </div>
                </StatTile>

                <StatTile label="Location">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="text-xs text-slate-200 truncate">
                      {[client.city, client.state, client.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                </StatTile>
              </div>
            </div>

            <div className="mx-5 mb-4 h-px bg-slate-900/[0.04] dark:bg-white/[0.06]" />

            {/* ── PROJECTS TABS ── */}
            <div className="mx-5 mb-5 bg-slate-900/[0.04] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center border-b border-slate-900/10 dark:border-white/[0.08] overflow-x-auto">
                {projects.length === 0 ? (
                  <div className="px-5 py-3 text-sm text-slate-500">No projects yet</div>
                ) : projects.map((p: any, idx: number) => (
                  <button key={p.id} onClick={() => setActiveProjectIdx(idx)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0
                      ${activeProjectIdx === idx ? 'border-sky-400 text-slate-900 dark:text-white bg-sky-500/5' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-200'}`}>
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold shrink-0
                      ${activeProjectIdx === idx ? 'bg-sky-500 text-white' : 'bg-slate-900/[0.04] dark:bg-white/[0.08] text-slate-600 dark:text-slate-400'}`}>
                      {idx + 1}
                    </span>
                    <span className="max-w-[120px] truncate">{p.domain}</span>
                    {p.status && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[p.status] || 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30'}`}>
                        {p.status?.replace(/_/g, ' ')}
                      </span>
                    )}
                  </button>
                ))}
                <Link href={`/clients/${client.id}/projects/new`}
                  className="flex items-center gap-1 px-4 py-3 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap ml-auto shrink-0 border-b-2 border-transparent">
                  <Plus className="h-3.5 w-3.5" /> Add Project
                </Link>
              </div>

              {selectedProject ? (
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                    {[
                      { label: 'Start Date', value: selectedProject.start_date ? new Date(selectedProject.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                      { label: 'Team Lead', value: client.dm_manager?.full_name || '—' },
                      { label: 'Sales Manager', value: client.sales_manager?.full_name || '—' },
                      { label: 'Mkt Manager', value: client.marketing_manager?.full_name || '—' },
                      { label: 'Project Status', value: selectedProject.status?.replace(/_/g, ' ') || '—' },
                      { label: 'Services', value: selectedProject.services?.length ? `${selectedProject.services.length} active` : '—' },
                    ].map(row => (
                      <div key={row.label}>
                        <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">{row.label}</p>
                        <p className="text-sm text-slate-200 font-medium capitalize">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  {selectedProject.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {selectedProject.services.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">{s}</span>
                      ))}
                    </div>
                  )}
                  <a href={`/clients/${client.id}/projects/${selectedProject.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 font-medium">
                    Read More <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm mb-3">No projects yet. Start one now.</p>
                  <Link href={`/clients/${client.id}/projects/new`}
                    className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Create First Project
                  </Link>
                </div>
              )}
            </div>

            {/* ── BOTTOM SECTION: Info + Services side by side ── */}
            <div className="mx-5 mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Info */}
              <div className="bg-slate-900/[0.04] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-sky-400 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Info
                </h3>
                <InfoRow label="Industry" value={client.industry} />
                <InfoRow label="Website" value={
                  client.website ? (
                    <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 flex items-center gap-1">
                      {client.website} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null
                } />
                <InfoRow label="Services" value={
                  pkgs.length > 0
                    ? pkgs.map((p: any) => p.service).join(', ')
                    : (client.services?.join(', ') || null)
                } />
                <InfoRow label="Ad Platforms" value={client.advertising_types?.join(', ')} />
                <InfoRow label="Target Audience" value={client.target_audience} />
                <InfoRow label="Goals" value={client.goals?.join(', ')} />
                <InfoRow label="About" value={
                  client.about_company ? (
                    <span className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed line-clamp-3">{client.about_company}</span>
                  ) : null
                } />
                {client.proposal_url && (
                  <div className="mt-3 pt-3 border-t border-slate-900/10 dark:border-white/[0.06]">
                    <a href={client.proposal_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                      <FileText className="h-3.5 w-3.5" /> View Proposal
                    </a>
                  </div>
                )}
              </div>

              {/* Services + Team */}
              <div className="flex flex-col gap-4">
                {/* Active / Expired Services tabs */}
                <div className="bg-slate-900/[0.04] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="flex border-b border-slate-900/10 dark:border-white/[0.08]">
                    <button onClick={() => setActiveServiceTab('active')}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeServiceTab === 'active' ? 'text-sky-400 bg-sky-500/5 border-b-2 border-sky-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-200'}`}>
                      Active Services
                    </button>
                    <button onClick={() => setActiveServiceTab('expired')}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeServiceTab === 'expired' ? 'text-slate-700 dark:text-slate-300 bg-slate-900/[0.04] dark:bg-white/[0.03] border-b-2 border-slate-400' : 'text-slate-500 hover:text-slate-300'}`}>
                      Expired Services
                    </button>
                  </div>
                  <div>
                    {activeServiceTab === 'active' ? (
                      pkgs.length > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-900/10 dark:border-white/[0.06]">
                              <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Service Name</th>
                              <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2">Monthly</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900/10 dark:divide-white/[0.04]">
                            {pkgs.map((p: any, i: number) => (
                              <tr key={i}>
                                <td className="px-4 py-2.5 text-sm text-slate-200">{p.service}</td>
                                <td className="px-4 py-2.5 text-sm text-sky-400 text-right font-semibold">${(parseFloat(p.price) || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-900/10 dark:border-white/[0.08] bg-slate-900/[0.04] dark:bg-white/[0.02]">
                              <td className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Total</td>
                              <td className="px-4 py-2 text-sm font-bold text-emerald-400 text-right">${monthlyRevenue.toLocaleString()}/mo</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <div className="px-4 py-6 text-center text-slate-500 text-sm">No active services</div>
                      )
                    ) : (
                      <div className="px-4 py-6 text-center text-slate-500 text-sm">No expired services</div>
                    )}
                  </div>
                </div>

                {/* Team */}
                <div className="bg-slate-900/[0.04] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Team</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Sales', person: client.sales_manager },
                      { label: 'Development', person: client.dm_manager },
                      { label: 'Marketing', person: client.marketing_manager },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-20 shrink-0">{row.label}</span>
                        {row.person ? (
                          <>
                            <AvatarBadge name={row.person.full_name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 font-medium leading-tight truncate">{row.person.full_name}</p>
                              {row.person.email && <p className="text-xs text-slate-500 truncate">{row.person.email}</p>}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600 italic">Unassigned</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── ADDITIONAL SELLING OPPORTUNITIES ── */}
            {(client.hashtags?.length > 0 || client.categories?.length > 0) && (
              <div className="mx-5 mb-5 bg-slate-900/[0.04] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-sky-400 mb-3">Additional Opportunities</h3>
                <div className="flex flex-wrap gap-2">
                  {[...(client.categories || []), ...(client.hashtags || [])].map((tag: string, i: number) => (
                    <span key={i} className="px-3 py-1 rounded-full border border-slate-900/10 dark:border-white/[0.12] text-xs text-slate-700 dark:text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors cursor-default">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── TIMELINE ── */}
            <div className="mx-5 mb-6 bg-slate-900/[0.04] dark:bg-white/[0.03] border border-slate-900/10 dark:border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-sky-400 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Timeline
              </h3>
              <div className="relative overflow-x-auto">
                <div className="flex items-center gap-0 min-w-max pb-2">
                  {/* Start point */}
                  <div className="flex flex-col items-center mr-6">
                    <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white text-xs font-bold mb-2">S</div>
                    <p className="text-[10px] text-slate-500">Start</p>
                  </div>

                  {/* Client added event */}
                  <div className="flex items-center">
                    <div className="w-16 h-px bg-slate-900/[0.04] dark:bg-white/[0.1]" />
                    <div className="flex flex-col items-center mx-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-400 mb-1" />
                      <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2 text-center mb-1">
                        <p className="text-[10px] text-sky-300 font-medium">Client Added</p>
                        {client.sales_manager && <p className="text-[10px] text-slate-600 dark:text-slate-400">by {client.sales_manager.full_name}</p>}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {client.created_at ? new Date(client.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  </div>

                  {/* Project events */}
                  {projects.map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center">
                      <div className="w-16 h-px bg-slate-900/[0.04] dark:bg-white/[0.1]" />
                      <div className="flex flex-col items-center mx-4">
                        <div className={`w-2.5 h-2.5 rounded-full mb-1 ${STATUS_DOT[p.status] || 'bg-slate-500'}`} />
                        <div className="bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.08] rounded-lg px-3 py-2 text-center mb-1 max-w-[140px]">
                          <p className="text-[10px] text-slate-200 font-medium truncate">Project {i + 1}</p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">{p.domain}</p>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {p.start_date ? new Date(p.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="w-16 h-px bg-slate-900/[0.04] dark:bg-white/[0.1]" />
                  <div className="w-2 h-2 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.1]" />
                </div>
                {/* Timeline line */}
                <div className="absolute top-[18px] left-0 right-0 h-px bg-slate-900/[0.04] dark:bg-white/[0.08] -z-0" style={{ top: '1rem' }} />
              </div>
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div className="mx-5 mb-6 flex gap-3 flex-wrap">
              <a href={`/clients/${client.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium rounded-xl hover:bg-sky-500/20 transition-colors">
                <Edit2 className="h-4 w-4" /> Edit Client
              </a>
              <a href={`/clients/${client.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-white/[0.08] transition-colors">
                <ExternalLink className="h-4 w-4" /> Full Page View
              </a>
              {client.google_drive_folder_url && (
                <a href={client.google_drive_folder_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/10 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-white/[0.08] transition-colors">
                  <ExternalLink className="h-4 w-4" /> Google Drive
                </a>
              )}
            </div>
          </div>
        ) : selectedId && !clientLoading ? (
          <div className="flex justify-center items-center h-64 text-slate-500 text-sm">Client not found</div>
        ) : null}
      </div>
    </div>
  )
}
