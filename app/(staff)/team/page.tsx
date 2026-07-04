'use client'
import { useState, useEffect } from 'react'
import { Plus, Edit2, UserX, Shield, Loader2, X } from 'lucide-react'

const tabs = ['Employees', 'Roles & Permissions', 'Client Accounts']

const ROLES: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-300' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-300' },
  manager: { label: 'Manager', color: 'bg-sky-500/20 text-sky-300' },
  team_member: { label: 'Team Member', color: 'bg-white/[0.08] text-slate-300' },
  billing_admin: { label: 'Billing Admin', color: 'bg-amber-500/20 text-amber-300' },
  client: { label: 'Client', color: 'bg-green-500/20 text-green-300' },
}

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
                      <button className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-white/[0.06]"><Edit2 className="h-4 w-4" /></button>
                      <button className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06]"><UserX className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {!loading && filtered.length === 0 && !search && (
            <div className="p-4 border-t border-white/[0.06] text-center text-slate-400">
              <p className="text-sm">Invite team members to populate this list</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 1 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-sky-400" />
            <h2 className="font-semibold text-white">Role Permission Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-2 px-3 text-slate-300 font-semibold">Module</th>
                  {['View', 'Create', 'Edit', 'Delete'].map(action => (
                    <th key={action} className="text-center py-2 px-3 text-slate-300 font-semibold">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {['Clients', 'Projects', 'Activity Records', 'Credentials', 'Messages', 'Marketing Reports', 'Google Ads Reports', 'Meta Ads Reports', 'Custom Reports', 'Team Management', 'Settings'].map(module => (
                  <tr key={module} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 font-medium text-slate-300">{module}</td>
                    {['view', 'create', 'edit', 'delete'].map(action => (
                      <td key={action} className="py-2.5 px-3 text-center">
                        <select className="text-xs bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
                          <option value="all">All</option>
                          <option value="team">Team</option>
                          <option value="own">Own</option>
                          <option value="none">None</option>
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-3">
            <select className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50">
              <option>Apply template...</option>
              <option>SEO Specialist</option>
              <option>Account Manager</option>
              <option>PPC Manager</option>
              <option>Finance</option>
            </select>
            <button className="btn-brand">Save Permissions</button>
          </div>
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
                        <button className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/[0.06]"><UserX className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
