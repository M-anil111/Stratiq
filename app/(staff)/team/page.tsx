'use client'
import { useState, useEffect } from 'react'
import { Plus, Edit2, UserX, Shield } from 'lucide-react'

const tabs = ['Employees', 'Roles & Permissions', 'Client Accounts']

const ROLES: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-300' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-300' },
  manager: { label: 'Manager', color: 'bg-sky-500/20 text-sky-300' },
  team_member: { label: 'Team Member', color: 'bg-white/[0.08] text-slate-300' },
  billing_admin: { label: 'Billing Admin', color: 'bg-amber-500/20 text-amber-300' },
  client: { label: 'Client', color: 'bg-green-500/20 text-green-300' },
}

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-slate-400 text-sm">Manage users, roles, and permissions</p>
        </div>
        <button className="btn-brand flex items-center gap-2">
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
        <div className="glass-card p-8 text-center text-slate-400">
          <p className="font-medium">No client portal accounts yet</p>
          <p className="text-sm mt-1">Invite clients from their client record to grant portal access</p>
        </div>
      )}
    </div>
  )
}
