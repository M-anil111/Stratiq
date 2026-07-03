'use client'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

const tabs = ['Team KPI Dashboard', 'Missed Activities', 'Target Settings']

const teamData = [
  { name: 'Alex Johnson', avatar: 'AJ', social: { target: 20, done: 16 }, offpage: { target: 30, done: 22 }, blog: { target: 4, done: 4 }, misses: 1 },
  { name: 'Sarah Chen', avatar: 'SC', social: { target: 20, done: 20 }, offpage: { target: 30, done: 30 }, blog: { target: 4, done: 3 }, misses: 0 },
  { name: 'Mike Torres', avatar: 'MT', social: { target: 20, done: 10 }, offpage: { target: 30, done: 18 }, blog: { target: 4, done: 2 }, misses: 3 },
]

function pct(done: number, target: number) { return target > 0 ? Math.round((done / target) * 100) : 0 }
function pctColor(p: number) { return p >= 80 ? 'text-green-600' : p >= 60 ? 'text-amber-600' : 'text-red-600' }
function barColor(p: number) { return p >= 80 ? 'bg-green-500' : p >= 60 ? 'bg-amber-500' : 'bg-red-500' }

export default function TargetsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const now = new Date()

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity & Targets</h1>
        <p className="text-gray-500 text-sm">{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Team Members', value: teamData.length },
              { label: 'On Track (≥80%)', value: teamData.filter(m => pct(m.social.done, m.social.target) >= 80).length },
              { label: 'Behind (<60%)', value: teamData.filter(m => pct(m.social.done, m.social.target) < 60).length },
              { label: 'Explanations Due', value: teamData.reduce((a, m) => a + m.misses, 0) },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Team table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Team Performance</h2>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                <option>All Clients</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Team Member', 'Social Media', 'Off-Page', 'Blog Posts', 'Misses', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teamData.map(member => {
                    const sp = pct(member.social.done, member.social.target)
                    const op = pct(member.offpage.done, member.offpage.target)
                    const bp = pct(member.blog.done, member.blog.target)
                    return (
                      <tr key={member.name} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">{member.avatar}</div>
                            <span className="font-medium text-gray-900">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full min-w-[60px]">
                              <div className={`h-full rounded-full ${barColor(sp)}`} style={{ width: `${sp}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${pctColor(sp)}`}>{member.social.done}/{member.social.target}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full min-w-[60px]">
                              <div className={`h-full rounded-full ${barColor(op)}`} style={{ width: `${op}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${pctColor(op)}`}>{member.offpage.done}/{member.offpage.target}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${pctColor(bp)}`}>{member.blog.done}/{member.blog.target}</span>
                        </td>
                        <td className="px-4 py-3">
                          {member.misses > 0 ? (
                            <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                              <AlertCircle className="h-3.5 w-3.5" /> {member.misses} week{member.misses > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs font-medium">&#10003; On track</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-xs text-sky-600 hover:text-sky-700 font-medium">View Details</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No missed activities requiring explanation</p>
          <p className="text-sm mt-1">Missed weekly targets will appear here when team members fall behind</p>
        </div>
      )}

      {activeTab === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Target Settings</h2>
          <p className="text-sm text-gray-500 mb-6">Set targets per project. Navigate to Clients → Project → Submission Details to set targets for a specific project.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['Social Media Posts', 'Off-Page Links', 'Blog Posts', 'OnPage URLs', 'Group Postings'].map(section => (
              <div key={section} className="border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{section} (default/month)</label>
                <input type="number" placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            ))}
          </div>
          <button className="mt-6 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg">Save Default Targets</button>
        </div>
      )}
    </div>
  )
}
