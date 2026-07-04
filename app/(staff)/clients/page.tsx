'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Users, Globe, Mail, Phone, MapPin, ExternalLink,
  ChevronRight, Edit2, FileText, Briefcase, TrendingUp, DollarSign,
  Loader2, X, Filter, Building2,
} from 'lucide-react'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  in_onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
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

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function AvatarBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const colors = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} ${color} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {initials(name)}
    </div>
  )
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
  const [projects, setProjects] = useState<any[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [activeProjectIdx, setActiveProjectIdx] = useState(0)
  const searchRef = useRef<NodeJS.Timeout>()

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

  const selectClient = (id: string) => {
    setSelectedId(id)
    setClient(null)
    setProjects([])
    setActiveProjectIdx(0)
    setClientLoading(true)
    setProjectsLoading(true)
    fetch(`/api/clients/${id}`).then(r => r.json()).then(d => { setClient(d); setClientLoading(false) })
    fetch(`/api/clients/${id}/projects`).then(r => r.json()).then(d => { setProjects(d || []); setProjectsLoading(false) })
  }

  const pkgs: any[] = client?.service_packages || []
  const monthlyRevenue = pkgs.reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
  const selectedProject = projects[activeProjectIdx]

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-72 shrink-0 border-r border-white/[0.08] flex flex-col bg-[#070f1c]">
        {/* Search always on top */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-slate-500 rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            />
            {search && (
              <button onClick={() => { setSearch(''); fetchClients('', statusFilter) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status filter chips */}
        <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-white/[0.06]">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => onStatus(f.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === f.value
                ? 'bg-sky-500 text-white'
                : 'bg-white/[0.05] text-slate-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Add client button */}
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <Link href="/clients/new"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium hover:bg-sky-500/20 transition-colors">
            <Plus className="h-4 w-4" /> Add New Client
          </Link>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : clients.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              {search ? 'No clients match your search' : 'No clients yet'}
            </div>
          ) : (
            clients.map(c => (
              <button key={c.id} onClick={() => selectClient(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-white/[0.04] transition-colors flex items-center gap-3 group
                  ${selectedId === c.id ? 'bg-sky-500/10 border-l-2 border-l-sky-500' : 'hover:bg-white/[0.04]'}`}>
                <AvatarBadge name={c.company_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.project_status] || 'bg-slate-500'}`} />
                    <p className="text-sm font-medium text-white truncate">{c.company_name}</p>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-slate-500 truncate">{c.website || c.industry || '—'}</p>
                    {c.service_packages?.length > 0 && (
                      <p className="text-xs text-sky-400 shrink-0 ml-2">
                        ${c.service_packages.reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer count */}
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <p className="text-xs text-slate-600">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-5">
              <Users className="h-10 w-10 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Select a client</h2>
            <p className="text-slate-500 text-sm max-w-xs">Pick a client from the list on the left to view their details, projects, and service packages.</p>
          </div>
        ) : clientLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : client && !client.error ? (
          <div className="p-6">
            {/* Client header */}
            <div className="flex items-start gap-4 mb-5">
              <AvatarBadge name={client.company_name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-xl font-bold text-white">{client.company_name}</h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[client.project_status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {client.project_status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  {client.website && (
                    <a href={`https://${client.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                      <Globe className="h-3 w-3" />{client.website}
                    </a>
                  )}
                  {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
                  {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
                  {(client.city || client.state) && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[client.city, client.state].filter(Boolean).join(', ')}</span>
                  )}
                </div>
              </div>
              <a href={`/clients/${client.id}/edit`}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] text-slate-300 text-xs font-medium rounded-lg hover:bg-white/[0.06] shrink-0">
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </a>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { icon: Briefcase, label: 'Projects', value: projects.length || '—', color: 'text-sky-400' },
                { icon: DollarSign, label: 'Monthly', value: monthlyRevenue > 0 ? `$${monthlyRevenue.toLocaleString()}` : '—', color: 'text-emerald-400' },
                { icon: TrendingUp, label: 'Services', value: pkgs.length || client.services?.length || '—', color: 'text-violet-400' },
                { icon: Building2, label: 'Industry', value: client.industry || '—', color: 'text-slate-300' },
              ].map(s => (
                <div key={s.label} className="glass-card px-4 py-3 flex items-center gap-3">
                  <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color} truncate`}>{String(s.value)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Projects — Explore-style numbered tabs */}
            <div className="glass-card mb-5">
              <div className="flex items-center gap-0 overflow-x-auto border-b border-white/[0.08]">
                {projectsLoading ? (
                  <div className="px-5 py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
                ) : projects.length === 0 ? (
                  <div className="px-5 py-3 text-sm text-slate-500">No projects yet</div>
                ) : (
                  projects.map((p, idx) => (
                    <button key={p.id} onClick={() => setActiveProjectIdx(idx)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeProjectIdx === idx
                        ? 'border-sky-400 text-white bg-sky-500/5'
                        : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${activeProjectIdx === idx ? 'bg-sky-500 text-white' : 'bg-white/[0.08] text-slate-400'}`}>
                        {idx + 1}
                      </span>
                      {p.domain}
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-slate-500/20 text-slate-400'}`}>
                        {p.status}
                      </span>
                    </button>
                  ))
                )}
                <Link href={`/clients/${client.id}/projects/new`}
                  className="flex items-center gap-1 px-4 py-3 text-sm text-sky-400 hover:text-sky-300 whitespace-nowrap ml-auto shrink-0">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Link>
              </div>

              {/* Selected project detail */}
              {selectedProject && (
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    {[
                      { label: 'Start Date', value: selectedProject.start_date ? new Date(selectedProject.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                      { label: 'Status', value: selectedProject.status?.replace(/_/g, ' ') || '—' },
                      { label: 'Industry', value: selectedProject.industry || '—' },
                      { label: 'Services', value: selectedProject.services?.length ? `${selectedProject.services.length} active` : '—' },
                    ].map(row => (
                      <div key={row.label}>
                        <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
                        <p className="text-sm text-slate-200 font-medium">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  {selectedProject.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {selectedProject.services.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-sky-500/10 text-sky-300 border border-sky-500/20">{s}</span>
                      ))}
                    </div>
                  )}
                  <a href={`/clients/${client.id}/projects/${selectedProject.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 font-medium">
                    Open full project view <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {!projectsLoading && projects.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm mb-3">No projects yet for this client.</p>
                  <Link href={`/clients/${client.id}/projects/new`}
                    className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Create first project
                  </Link>
                </div>
              )}
            </div>

            {/* Service packages */}
            {pkgs.length > 0 && (
              <div className="glass-card mb-5">
                <div className="px-5 py-3 border-b border-white/[0.08] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Service Packages</h3>
                  <span className="text-xs text-slate-500">${monthlyRevenue.toLocaleString()}/mo total</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {pkgs.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                        <span className="text-sm text-slate-200">{p.service}</span>
                        {p.contract_term && <span className="text-xs text-slate-500">· {p.contract_term}</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-sky-400">${(parseFloat(p.price) || 0).toLocaleString()}/mo</p>
                        {parseFloat(p.setup_fee) > 0 && <p className="text-xs text-slate-500">${(parseFloat(p.setup_fee)).toLocaleString()} setup</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Team */}
              <div className="glass-card p-5">
                <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Team</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Sales', person: client.sales_manager },
                    { label: 'Dev', person: client.dm_manager },
                    { label: 'Marketing', person: client.marketing_manager },
                  ].map(row => row.person ? (
                    <div key={row.label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-16 shrink-0">{row.label}</span>
                      <AvatarBadge name={row.person.full_name} size="sm" />
                      <div>
                        <p className="text-sm text-slate-200 font-medium leading-tight">{row.person.full_name}</p>
                        {row.person.email && <p className="text-xs text-slate-500">{row.person.email}</p>}
                      </div>
                    </div>
                  ) : null)}
                  {!client.sales_manager && !client.dm_manager && !client.marketing_manager && (
                    <p className="text-sm text-slate-500">No team assigned</p>
                  )}
                </div>
              </div>

              {/* Links + About */}
              <div className="glass-card p-5">
                <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Links</h3>
                <div className="space-y-2 mb-3">
                  {client.google_drive_folder_url && (
                    <a href={client.google_drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                      <ExternalLink className="h-3.5 w-3.5" /> Google Drive
                    </a>
                  )}
                  {client.proposal_url && (
                    <a href={client.proposal_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                      <FileText className="h-3.5 w-3.5" /> Proposal
                    </a>
                  )}
                  {client.ndisk_link && (
                    <a href={client.ndisk_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300">
                      <ExternalLink className="h-3.5 w-3.5" /> nDisk
                    </a>
                  )}
                </div>
                {client.about_company && (
                  <>
                    <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2">About</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{client.about_company}</p>
                  </>
                )}
                <div className="mt-3">
                  <a href={`/clients/${client.id}`}
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium">
                    Full client page <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
