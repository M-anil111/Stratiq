'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, FolderOpen, Activity, TrendingUp, Plus, ArrowRight, Sparkles } from 'lucide-react'

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

const typeBadge: Record<string, { label: string; color: string }> = {
  social:  { label: 'Social',    color: 'rgba(14,165,233,0.15) border-[rgba(14,165,233,0.3)] text-sky-300' },
  offpage: { label: 'Off-Page',  color: 'rgba(16,185,129,0.15) border-[rgba(16,185,129,0.3)] text-emerald-300' },
  blog:    { label: 'Blog',      color: 'rgba(245,158,11,0.15) border-[rgba(245,158,11,0.3)] text-amber-300' },
  onpage:  { label: 'OnPage',    color: 'rgba(139,92,246,0.15) border-[rgba(139,92,246,0.3)] text-violet-300' },
  group:   { label: 'Group',     color: 'rgba(236,72,153,0.15) border-[rgba(236,72,153,0.3)] text-pink-300' },
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
    {
      label: 'Total Clients', value: stats ? String(stats.total_clients) : null,
      icon: Users, href: '/clients',
      gradient: 'from-sky-500/20 to-sky-600/10', iconColor: 'text-sky-400', iconBg: 'bg-sky-500/15 border-sky-500/20',
    },
    {
      label: 'Active Projects', value: stats ? String(stats.active_projects) : null,
      icon: FolderOpen, href: '/clients',
      gradient: 'from-emerald-500/20 to-emerald-600/10', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/20',
    },
    {
      label: 'Activities This Month', value: stats ? String(stats.activities_this_month) : null,
      icon: Activity, href: '/targets',
      gradient: 'from-amber-500/20 to-amber-600/10', iconColor: 'text-amber-400', iconBg: 'bg-amber-500/15 border-amber-500/20',
    },
    {
      label: 'Targets Hit', value: stats ? `${stats.targets_hit_pct}%` : null,
      icon: TrendingUp, href: '/targets',
      gradient: 'from-violet-500/20 to-violet-600/10', iconColor: 'text-violet-400', iconBg: 'bg-violet-500/15 border-violet-500/20',
    },
  ]

  return (
    <div className="p-5 lg:p-8 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-float-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-medium text-sky-400 uppercase tracking-widest">Agency Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-0.5">Here's what's happening at Stratiq</p>
        </div>
        <Link
          href="/clients/new"
          className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Client</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((card, i) => (
          <Link
            key={card.label}
            href={card.href}
            className="glass-card p-5 group animate-float-up"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl border ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{card.label}</p>
              {card.value
                ? <p className="text-2xl font-bold text-white">{card.value}</p>
                : <div className="skeleton h-8 w-16 mt-1" />
              }
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { href: '/clients/new', title: 'Add Client', sub: 'Onboard a new client', delay: 300 },
          { href: '/reports', title: 'View Reports', sub: 'Marketing performance', delay: 375 },
          { href: '/targets', title: 'Track Targets', sub: 'Team KPI dashboard', delay: 450 },
        ].map(({ href, title, sub, delay }) => (
          <Link
            key={href}
            href={href}
            className="glass-card p-4 flex items-center justify-between group animate-float-up"
            style={{ animationDelay: `${delay}ms` }}
          >
            <div>
              <p className="font-semibold text-white text-sm">{title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-sky-400 group-hover:translate-x-1 transition-all duration-200" />
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6 animate-float-up animate-delay-500">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white">Recent Activity</h2>
          <Link href="/targets" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">View all →</Link>
        </div>

        {activityLoading ? (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-5 w-16" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-600">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
              <Activity className="h-6 w-6 opacity-40" />
            </div>
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1 text-slate-700">Add a client and start logging work</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activity.map((item, i) => {
              const badge = typeBadge[item.type]
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.04] transition-colors duration-150 group animate-float-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border shrink-0"
                    style={{ background: badge ? badge.color.split(' ')[0] : 'rgba(100,100,100,0.15)' }}
                  >
                    {badge?.label || item.type}
                  </span>
                  <span className="text-sm text-slate-300 flex-1 truncate">{item.label}</span>
                  {item.client && (
                    <span className="text-xs text-slate-600 shrink-0 hidden sm:block group-hover:text-slate-500 transition-colors">{item.client}</span>
                  )}
                  <span className="text-xs text-slate-700 shrink-0">{timeAgo(item.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
