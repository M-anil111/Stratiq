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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
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
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Activity className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs mt-1">Add a client and start logging work</p>
        </div>
      </div>
    </div>
  )
}
