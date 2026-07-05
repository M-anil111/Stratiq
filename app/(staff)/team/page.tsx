'use client'
import { useState, useEffect } from 'react'
import { Plus, Edit2, UserX, Shield, Loader2, X, Check } from 'lucide-react'

const tabs = ['Employees', 'Roles & Permissions', 'Client Accounts']

const ROLES: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-300' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-300' },
  manager: { label: 'Manager', color: 'bg-sky-500/20 text-sky-300' },
  team_member: { label: 'Team Member', color: 'bg-white/[0.08] text-slate-300' },
  billing_admin: { label: 'Billing Admin', color: 'bg-amber-500/20 text-amber-300' },
  client: { label: 'Client', color: 'bg-green-500/20 text-green-300' },
}

const ROLE_DESCRIPTIONS = [
  {
    role: 'admin',
    label: 'Admin',
    color: 'bg-blue-500/20 text-blue-300',
    description: 'Full access to all features. Can manage team members, billing, and organization settings.',
    permissions: ['All modules (view, create, edit, delete)', 'Invite & remove team members', 'Change member roles', 'Manage billing & settings'],
  },
  {
    role: 'manager',
    label: 'Manager',
    color: 'bg-sky-500/20 text-sky-300',
    description: 'Can manage clients, projects, and reports. Cannot manage team or billing.',
    permissions: ['Clients (view, create, edit)', 'Projects (view, create, edit, delete)', 'Reports (view, create)', 'Messages (view, send)', 'Cannot manage team or billing'],
  },
  {
    role: 'team_member',
    label: 'Team Member',
    color: 'bg-white/[0.08] text-slate-300',
    description: 'Standard staff access. Can view and work with assigned clients and projects.',
    permissions: ['Clients (view)', 'Projects (view, edit own)', 'Activity records (create, edit own)', 'Messages (view, send)', 'Reports (view)'],
  },
  {
    role: 'billing_admin',
    label: 'Billing Admin',
    color: 'bg-amber-500/20 text-amber-300',
    description: 'Access to billing and financial reporting only.',
    permissions: ['Billing & invoices (full access)', 'Financial reports (view)', 'Cannot access client or project data'],
  },
  {
    role: 'client',
    label: 'Client',
    color: 'bg-green-500/20 text-green-300',
    description: 'Portal-only access. Can view their own reports and communicate with the team.',
    permissions: ['Own reports (view)', 'Messages (view, send)', 'Own project status (view)', 'No access to internal data'],
  },
]

const DEFAULT_FORM = { full_name: '', email: '', role: 'team_member' }

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState(DEFAULT_FORM)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [hideRoleSelect, setHideRoleSelect] = useState(false)

  // Edit role modal
  const [editingMember, setEditingMember] = useState<any>(null)
  const [editRole, setEditRole] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Remove confirmation
  const [removingMember, setRemovingMember] = useState<any>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/team')
      .then(res => res.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = members.filter(m =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
  )

  const clients = members.filter(m => m.role === 'client')

  function openEdit(member: any) {
    setEditingMember(member)
    setEditRole(member.role)
    setEditError('')
  }

  function closeEdit() {
    setEditingMember(null)
    setEditError('')
  }

  async function handleEditSave() {
    if (!editingMember) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/team/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      })
      const d = await res.json()
      if (!res.ok) { setEditError(d.error || 'Failed to update role'); return }
      setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, role: editRole } : m))
      closeEdit()
    } catch {
      setEditError('Network error. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  function openRemove(member: any) {
    setRemovingMember(member)
    setRemoveError('')
  }

  function closeRemove() {
    setRemovingMember(null)
    setRemoveError('')
  }

  async function handleRemove() {
    if (!removingMember) return
    setRemoveLoading(true)
    setRemoveError('')
    try {
      const res = await fetch(`/api/team/${removingMember.id}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) { setRemoveError(d.error || 'Failed to remove member'); return }
      setMembers(prev => prev.filter(m => m.id !== removingMember.id))
      closeRemove()
    } catch {
      setRemoveError('Network error. Please try again.')
    } finally {
      setRemoveLoading(false)
    }
  }

  function openInvite(clientMode = false) {
    setInviteForm(clientMode ? { ...DEFAULT_FORM, role: 'client' } : DEFAULT_FORM)
    setHideRoleSelect(clientMode)
    setInviteError('')
    setShowInvite(true)
  }

  function closeInvite() {
    setShowInvite(false)
    setInviteError('')
    setInviteSuccess('')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })
      const d = await res.json()
      if (!res.ok) {
        setInviteError(d.error || 'Failed to invite member')
        return
      }
      if (d.member) setMembers(prev => [...prev, d.member])
      setInviteSuccess(`Invite sent to ${inviteForm.email}`)
      setTimeout(() => closeInvite(), 2000)
    } catch {
      setInviteError('Network error. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-slate-400 text-sm">Manage users, roles, and permissions</p>
        </div>
        <button className="btn-brand flex items-center gap-2" onClick={() => openInvite(false)}>
          <Plus className="h-4 w-4" /> Invite Member
        </button>
      </div>

      <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div className="glass-card">
          <div className="p-4 border-b border-white/[0.08]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="input-glass sm:w-72"
            />
          </div>
          <div className="divide-y divide-white/[0.06]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full skeleton" />
                    <div>
                      <div className="h-4 skeleton rounded w-32 mb-1" />
                      <div className="h-3 skeleton rounded w-48" />
                    </div>
                  </div>
                  <div className="h-5 skeleton rounded w-20" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                {search ? 'No members match your search' : 'No team members yet'}
              </div>
            ) : (
              filtered.map(user => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/[0.08] text-slate-300 flex items-center justify-center font-semibold text-sm">
                        {(user.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white text-sm">{user.full_name}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLES[user.role]?.color || 'bg-white/[0.08] text-slate-300'}`}>
                      {ROLES[user.role]?.label || user.role}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(user)} className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-white/[0.06]"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => openRemove(user)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06]"><UserX className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-sky-400" />
            <h2 className="font-semibold text-white">Roles &amp; Permissions</h2>
          </div>
          {ROLE_DESCRIPTIONS.map(r => (
            <div key={r.role} className="glass-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.color}`}>{r.label}</span>
                <p className="text-sm text-slate-300">{r.description}</p>
              </div>
              <ul className="mt-3 space-y-1">
                {r.permissions.map(p => (
                  <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
                    <Check className="h-3.5 w-3.5 text-sky-400 mt-0.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeTab === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">{clients.length} client account{clients.length !== 1 ? 's' : ''}</p>
            <button className="btn-brand flex items-center gap-2" onClick={() => openInvite(true)}>
              <Plus className="h-4 w-4" /> Invite Client
            </button>
          </div>
          <div className="glass-card">
            <div className="divide-y divide-white/[0.06]">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full skeleton" />
                      <div>
                        <div className="h-4 skeleton rounded w-32 mb-1" />
                        <div className="h-3 skeleton rounded w-48" />
                      </div>
                    </div>
                    <div className="h-5 skeleton rounded w-16" />
                  </div>
                ))
              ) : clients.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  <p className="font-medium">No client portal accounts yet</p>
                  <p className="mt-1">Invite clients to grant them portal access</p>
                </div>
              ) : (
                clients.map(user => (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-green-500/20 text-green-300 flex items-center justify-center font-semibold text-sm">
                          {(user.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white text-sm">{user.full_name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300">Client</span>
                      <div className="flex gap-1">
                        <button onClick={() => openRemove(user)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06]"><UserX className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Edit Role</h2>
              <button onClick={closeEdit} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{editingMember.full_name} &mdash; {editingMember.email}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="input-glass"
              >
                <option value="team_member">Team Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="billing_admin">Billing Admin</option>
              </select>
            </div>
            {editError && <p className="text-sm text-red-400 mb-3">{editError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeEdit} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Remove Member</h2>
              <button onClick={closeRemove} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to remove <span className="text-white font-medium">{removingMember.full_name}</span> from your team? This action cannot be undone.
            </p>
            {removeError && <p className="text-sm text-red-400 mb-3">{removeError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeRemove} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleRemove} disabled={removeLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-60">
                {removeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {removeLoading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">
                {hideRoleSelect ? 'Invite Client' : 'Invite Member'}
              </h2>
              <button onClick={closeInvite} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="input-glass"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="input-glass"
                  required
                />
              </div>
              {!hideRoleSelect && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                    className="input-glass"
                  >
                    <option value="team_member">Team Member</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="billing_admin">Billing Admin</option>
                  </select>
                </div>
              )}
              {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-green-400 flex items-center gap-1">✓ {inviteSuccess}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeInvite} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={inviting} className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                  {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {inviting ? 'Inviting…' : 'Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
