'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, XCircle, Search, Trash2, ToggleLeft, ToggleRight,
  Clock, Building2, Target, ListChecks, Receipt, FileText, Star, Activity,
} from 'lucide-react'
import AddButton from '@/components/ui/AddButton'

const CATEGORIES = [
  { key: 'industry', label: 'Industries', icon: Building2, description: 'Industry sectors used to classify clients' },
  { key: 'goal', label: 'Goals', icon: Target, description: 'Client engagement goals' },
  { key: 'expectation', label: 'Expectations', icon: ListChecks, description: 'What clients expect from the engagement' },
  { key: 'billing_term', label: 'Billing Terms', icon: Receipt, description: 'Billing cadence options' },
  { key: 'contract_term', label: 'Contract Terms', icon: FileText, description: 'Contract length options' },
  { key: 'client_degree', label: 'Client Priority', icon: Star, description: 'Client priority tiers' },
  { key: 'project_status', label: 'Project Statuses', icon: Activity, description: 'Lifecycle statuses for projects' },
] as const

interface Master {
  id: string
  category: string
  value: string
  label: string
  description?: string
  sort_order: number
  is_active: boolean
  approval_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  created_by_user?: { full_name: string; email: string }
  approved_by_user?: { full_name: string }
  approved_at?: string
}

export default function MastersPage() {
  const [activeTab, setActiveTab] = useState<string>('industry')
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ label: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  const fetchMasters = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/settings/masters?status=all')
    if (res.ok) setMasters(await res.json())
    setLoading(false)
  }, [])

  const fetchRole = useCallback(async () => {
    const res = await fetch('/api/me')
    if (res.ok) {
      const d = await res.json()
      setUserRole(d.role || '')
    }
  }, [])

  useEffect(() => {
    fetchMasters()
    fetchRole()
  }, [fetchMasters, fetchRole])

  const isAdmin = ['super_admin', 'admin'].includes(userRole)
  const activeCategory = CATEGORIES.find(c => c.key === activeTab)!

  const filtered = masters
    .filter(m => m.category === activeTab)
    .filter(m => !search || m.label.toLowerCase().includes(search.toLowerCase()))

  const pending = filtered.filter(m => m.approval_status === 'pending')
  const approved = filtered.filter(m => m.approval_status === 'approved')
  const rejected = filtered.filter(m => m.approval_status === 'rejected')

  const handleAction = async (id: string, action: string, extra?: any) => {
    await fetch('/api/settings/masters', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    })
    fetchMasters()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this value?')) return
    await fetch(`/api/settings/masters?id=${id}`, { method: 'DELETE' })
    fetchMasters()
  }

  const handleAdd = async () => {
    if (!addForm.label.trim()) return
    setAdding(true)
    await fetch('/api/settings/masters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: activeTab, label: addForm.label, description: addForm.description }),
    })
    setAdding(false)
    setShowAdd(false)
    setAddForm({ label: '', description: '' })
    fetchMasters()
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
      approved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
    }
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] || ''}`}>
        {status}
      </span>
    )
  }

  const MasterRow = ({ m }: { m: Master }) => (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-lg transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${m.is_active ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
            {m.label}
          </span>
          <StatusBadge status={m.approval_status} />
          {!m.is_active && <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">inactive</span>}
        </div>
        {m.description && <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>}
        <p className="text-[10px] text-slate-600 mt-1">
          Added by {m.created_by_user?.full_name || 'Unknown'}
          {m.approved_by_user && ` · Approved by ${m.approved_by_user.full_name}`}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {m.approval_status === 'pending' && isAdmin && (
          <>
            <button onClick={() => handleAction(m.id, 'approve')}
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors" title="Approve">
              <CheckCircle size={15} />
            </button>
            <button onClick={() => handleAction(m.id, 'reject')}
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors" title="Reject">
              <XCircle size={15} />
            </button>
          </>
        )}
        {m.approval_status === 'approved' && isAdmin && (
          <button onClick={() => handleAction(m.id, 'update', { is_active: !m.is_active })}
            className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 transition-colors"
            title={m.is_active ? 'Deactivate' : 'Activate'}>
            {m.is_active ? <ToggleRight size={15} className="text-emerald-400" /> : <ToggleLeft size={15} />}
          </button>
        )}
        {isAdmin && (
          <button onClick={() => handleDelete(m.id)}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 transition-colors" title="Delete">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-mesh">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Data Sets</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage the dropdown values used across the platform. Each data set has its own tab.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* HubSpot-style vertical sub-tabs */}
          <aside className="lg:w-56 shrink-0">
            {/* Horizontal scroll on mobile, vertical list on desktop */}
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                const pendingCount = masters.filter(m => m.category === cat.key && m.approval_status === 'pending').length
                const active = activeTab === cat.key
                return (
                  <button key={cat.key}
                    onClick={() => { setActiveTab(cat.key); setSearch('') }}
                    className={`flex-shrink-0 lg:w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors relative ${
                      active ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{cat.label}</span>
                    {pendingCount > 0 && (
                      <span className="ml-auto bg-amber-500 text-white text-[9px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Active data set panel */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <activeCategory.icon className="h-5 w-5 text-sky-400" />
                  {activeCategory.label}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{activeCategory.description}</p>
              </div>
              <AddButton label="Add Value" onClick={() => setShowAdd(true)} />
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Search bar */}
              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={`Search ${activeCategory.label.toLowerCase()}...`}
                    className="input-glass w-full pl-8 pr-4 py-2 rounded-xl text-sm" />
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm">No values yet for this data set.</p>
                  <button onClick={() => setShowAdd(true)} className="mt-3 text-sky-400 text-sm hover:underline">+ Add the first one</button>
                </div>
              ) : (
                <div className="p-2">
                  {pending.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 px-4 py-2">
                        <Clock size={12} className="text-amber-400" />
                        <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Pending Approval ({pending.length})</span>
                      </div>
                      {pending.map(m => <MasterRow key={m.id} m={m} />)}
                    </div>
                  )}
                  {approved.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 px-4 py-2">
                        <CheckCircle size={12} className="text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Approved ({approved.length})</span>
                      </div>
                      {approved.map(m => <MasterRow key={m.id} m={m} />)}
                    </div>
                  )}
                  {rejected.length > 0 && isAdmin && (
                    <div>
                      <div className="flex items-center gap-2 px-4 py-2">
                        <XCircle size={12} className="text-red-400" />
                        <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Rejected ({rejected.length})</span>
                      </div>
                      {rejected.map(m => <MasterRow key={m.id} m={m} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="glass-card rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-1">Add New Value</h2>
            <p className="text-xs text-slate-400 mb-4">
              Data set: <strong className="text-slate-300">{activeCategory.label}</strong>
              {!isAdmin && <span className="ml-2 text-amber-400">(requires admin approval)</span>}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Label <span className="text-red-400">*</span></label>
                <input value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. New Industry Name"
                  className="input-glass w-full px-3 py-2.5 rounded-xl text-sm" autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description <span className="text-slate-600">(optional)</span></label>
                <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of when to use this value..."
                  rows={2} className="input-glass w-full px-3 py-2.5 rounded-xl text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-white/5 hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={adding || !addForm.label.trim()}
                className="flex-1 btn-brand px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {adding ? 'Adding...' : isAdmin ? 'Add & Approve' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
