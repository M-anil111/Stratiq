'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, FolderOpen, Activity, TrendingUp, Plus, ArrowRight } from 'lucide-react'

interface Stats {
  total_clients: number
  active_projects: number
  activities_this_month: number
  targets_hit_pct: number
}

interface ActivityItem {
  type: string
  label: string
  client: string
  created_at: string
}

const typeColors: Record<string, string> = {
  social: 'bg-sky-100 text-sky-700',
  offpage: 'bg-emerald-100 text-emerald-700',
  blog: 'bg-amber-100 text-amber-700',
  onpage: 'bg-purple-100 text-purple-700',
  group: 'bg-pink-100 text-pink-700',
}

const typeLabels: Record<string, string> = {
  social: 'Social',
  offpage: 'Off-Page',
  blog: 'Blog',
  onpage: 'OnPage',
  group: 'Group',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
    fetch('/api/dashboard/activity')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setActivity(data) })
      .finally(() => setActivityLoading(false))
  }, [])

  const kpiCards = [
    { label: 'Total Clients', value: stats ? String(stats.total_clients) : '—', icon: Users, color: 'bg-sky-50 text-sky-600', href: '/clients' },
    { label: 'Active Projects', value: stats ? String(stats.active_projects) : '—', icon: FolderOpen, color: 'bg-emerald-50 text-emerald-600', href: '/clients' },
    { label: 'Activities This Month', value: stats ? String(stats.activities_this_month) : '—', icon: Activity, color: 'bg-amber-50 text-amber-600', href: '/targets' },
    { label: 'Targets Hit %', value: stats ? `${stats.targets_hit_pct}%` : '—', icon: TrendingUp, color: 'bg-purple-50 text-purple-600', href: '/targets' },
  ]

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back to Stratiq</p>
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Client</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(card => (
          <Link key={card.label} href={card.href} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stats ? 'text-gray-900' : 'text-gray-300 animate-pulse'}`}>{card.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { href: '/clients/new', title: 'Add Client', sub: 'Onboard a new client' },
          { href: '/reports', title: 'View Reports', sub: 'Marketing performance' },
          { href: '/targets', title: 'Track Targets', sub: 'Team KPI dashboard' },
        ].map(({ href, title, sub }) => (
          <Link key={href} href={href} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow group">
            <div>
              <p className="font-semibold text-gray-900">{title}</p>
              <p className="text-sm text-gray-500">{sub}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-sky-500 transition-colors" />
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {activityLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-14 h-5 bg-gray-100 rounded-full" />
                <div className="flex-1 h-4 bg-gray-100 rounded" />
                <div className="w-12 h-4 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Activity className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Add a client and start logging work</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${typeColors[item.type] || 'bg-gray-100 text-gray-600'}`}>
                  {typeLabels[item.type] || item.type}
                </span>
                <span className="text-sm text-gray-700 flex-1 truncate">{item.label}</span>
                {item.client && <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{item.client}</span>}
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
