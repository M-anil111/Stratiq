'use client'
import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

const tabs = ['Team KPI Dashboard', 'Missed Activities', 'Target Settings']

function pct(done: number, target: number) { return target > 0 ? Math.round((done / target) * 100) : 0 }
function pctColor(p: number) { return p >= 80 ? 'text-green-400' : p >= 60 ? 'text-amber-400' : 'text-red-400' }
function barColor(p: number) { return p >= 80 ? 'bg-green-500' : p >= 60 ? 'bg-amber-500' : 'bg-red-500' }

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function TargetsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [teamData, setTeamData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const month = currentMonth()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/targets?month=${month}`)
      .then(res => res.json())
      .then(data => setTeamData(Array.isArray(data) ? data : []))
      .catch(() => setTeamData([]))
      .finally(() => setLoading(false))
  }, [month])

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activity & Targets</h1>
        <p className="text-slate-400 text-sm">{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card p-4 text-center">
                  <div className="h-8 skeleton rounded mb-2 mx-auto w-12" />
                  <div className="h-3 skeleton rounded mx-auto w-24" />
                </div>
              ))
            ) : (
              [
                { label: 'Team Members', value: teamData.length },
                { label: 'On Track (≥80%)', value: teamData.filter(m => pct(m.actuals.social, m.targets.social) >= 80).length },
                { label: 'Behind (<60%)', value: teamData.filter(m => pct(m.actuals.social, m.targets.social) < 60).length },
                { label: 'No Targets Set', value: teamData.filter(m => m.targets.social === 0 && m.targets.offpage === 0 && m.targets.blog === 0).length },
              ].map(card => (
                <div key={card.label} className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{card.label}</p>
                </div>
              ))
            )}
          </div>

          {/* Team table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <h2 className="font-semibold text-white">Team Performance</h2>
              <select className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50">
                <option>All Clients</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03]">
                  <tr>
                    {['Team Member', 'Social Media', 'Off-Page', 'Blog Posts', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full skeleton" />
                            <div className="h-4 skeleton rounded w-28" />
                          </div>
                        </td>
                        {[0, 1, 2].map(j => (
                          <td key={j} className="px-4 py-3"><div className="h-3 skeleton rounded w-24" /></td>
                        ))}
                        <td className="px-4 py-3"><div className="h-3 skeleton rounded w-16" /></td>
                      </tr>
                    ))
                  ) : teamData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No team members found</td>
                    </tr>
                  ) : (
                    teamData.map(member => {
                      const sp = pct(member.actuals.social, member.targets.social)
                      const op = pct(member.actuals.offpage, member.targets.offpage)
                      const bp = pct(member.actuals.blog, member.targets.blog)
                      return (
                        <tr key={member.user_id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/[0.08] text-slate-300 flex items-center justify-center text-xs font-bold">{member.avatar_initials}</div>
                              )}
                              <span className="font-medium text-white">{member.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full min-w-[60px]">
                                <div className={`h-full rounded-full ${barColor(sp)}`} style={{ width: `${Math.min(sp, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${pctColor(sp)}`}>{member.actuals.social}/{member.targets.social}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full min-w-[60px]">
                                <div className={`h-full rounded-full ${barColor(op)}`} style={{ width: `${Math.min(op, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${pctColor(op)}`}>{member.actuals.offpage}/{member.targets.offpage}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${pctColor(bp)}`}>{member.actuals.blog}/{member.targets.blog}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-xs text-sky-400 hover:text-sky-300 font-medium">View Details</button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="glass-card p-8 text-center text-slate-400">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No missed activities requiring explanation</p>
          <p className="text-sm mt-1">Missed weekly targets will appear here when team members fall behind</p>
        </div>
      )}

      {activeTab === 2 && (
        <div className="glass-card p-6">
          <h2 className="font-semibold text-white mb-4">Monthly Target Settings</h2>
          <p className="text-sm text-slate-400 mb-6">Set targets per project. Navigate to Clients → Project → Submission Details to set targets for a specific project.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['Social Media Posts', 'Off-Page Links', 'Blog Posts', 'OnPage URLs', 'Group Postings'].map(section => (
              <div key={section} className="border border-white/[0.08] rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">{section} (default/month)</label>
                <input type="number" placeholder="0" className="input-glass" />
              </div>
            ))}
          </div>
          <button className="mt-6 btn-brand">Save Default Targets</button>
        </div>
      )}
    </div>
  )
}
