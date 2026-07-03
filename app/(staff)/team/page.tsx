'use client'
import { useState } from 'react'
import { Plus, Edit2, UserX, Shield } from 'lucide-react'

const tabs = ['Employees', 'Roles & Permissions', 'Client Accounts']

const ROLES = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-800' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-800' },
  manager: { label: 'Manager', color: 'bg-sky-100 text-sky-800' },
  team_member: { label: 'Team Member', color: 'bg-gray-100 text-gray-700' },
  billing_admin: { label: 'Billing Admin', color: 'bg-amber-100 text-amber-800' },
  client: { label: 'Client', color: 'bg-green-100 text-green-800' },
}

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm">Manage users, roles, and permissions</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg">
          <Plus className="h-4 w-4" /> Invite Member
        </button>
      </div>

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <input type="text" placeholder="Search team members..." className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { name: 'Jay Mehta', email: 'jay@mindshareconsulting.com', role: 'super_admin', lastSeen: 'Today' },
            ].map(user => (
              <div key={user.email} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold text-sm">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLES[user.role as keyof typeof ROLES]?.color}`}>
                    {ROLES[user.role as keyof typeof ROLES]?.label}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:block">{user.lastSeen}</span>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-gray-400 hover:text-sky-600 rounded-lg hover:bg-gray-100"><Edit2 className="h-4 w-4" /></button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"><UserX className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">Invite team members to populate this list</p>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-sky-600" />
            <h2 className="font-semibold text-gray-900">Role Permission Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-700 font-semibold">Module</th>
                  {['View', 'Create', 'Edit', 'Delete'].map(action => (
                    <th key={action} className="text-center py-2 px-3 text-gray-700 font-semibold">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {['Clients', 'Projects', 'Activity Records', 'Credentials', 'Messages', 'Marketing Reports', 'Google Ads Reports', 'Meta Ads Reports', 'Custom Reports', 'Team Management', 'Settings'].map(module => (
                  <tr key={module} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">{module}</td>
                    {['view', 'create', 'edit', 'delete'].map(action => (
                      <td key={action} className="py-2.5 px-3 text-center">
                        <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
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
            <select className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option>Apply template...</option>
              <option>SEO Specialist</option>
              <option>Account Manager</option>
              <option>PPC Manager</option>
              <option>Finance</option>
            </select>
            <button className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg">Save Permissions</button>
          </div>
        </div>
      )}

      {activeTab === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          <p className="font-medium">No client portal accounts yet</p>
          <p className="text-sm mt-1">Invite clients from their client record to grant portal access</p>
        </div>
      )}
    </div>
  )
}
