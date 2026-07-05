'use client'

import Link from 'next/link'
import { FolderOpen, Files, MessageSquare, ArrowRight, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PortalStats {
  active_projects: number
  files_count: number
  unread_messages: number
}

function StatSkeleton() {
  return (
    <div className="glass-card p-4 text-center animate-pulse">
      <div className="h-8 w-8 bg-white/10 rounded mx-auto mb-2" />
      <div className="h-3 w-16 bg-white/10 rounded mx-auto" />
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function PortalHomePage() {
  const [stats, setStats] = useState<PortalStats | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [upsellVisible, setUpsellVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('portal_upsell_dismissed')) {
      setUpsellVisible(true)
    }
  }, [])

  useEffect(() => {
    fetch('/api/portal/stats')
      .then(r => {
        if (!r.ok) { setStatsError(true); return null }
        return r.json()
      })
      .then(data => { if (data) setStats(data) })
      .catch(() => setStatsError(true))
      .finally(() => setLoading(false))
  }, [])

  function dismissUpsell() {
    localStorage.setItem('portal_upsell_dismissed', '1')
    setUpsellVisible(false)
  }

  return (
    <div>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{getGreeting()} 👋</h1>
        <p className="text-slate-400 mt-1">Here&apos;s what&apos;s happening with your projects</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : statsError ? (
          <div className="col-span-3 glass-card p-4 text-center text-slate-400 text-sm">Unable to load stats. Please refresh the page.</div>
        ) : (
          <>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats?.active_projects ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">Active Projects</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats?.files_count ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">Files</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats?.unread_messages ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">Messages</p>
            </div>
          </>
        )}
      </div>

      {/* Upsell card */}
      {upsellVisible && (
        <div className="mb-8 glass-card p-4 border-sky-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-white">Grow 3x faster with Google Ads</p>
              <p className="text-sm text-slate-400 mt-1">Get a free audit and see how paid search can triple your leads.</p>
              <Link href="#" className="inline-block mt-3 px-4 py-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white text-sm rounded-lg hover:from-sky-400 hover:to-sky-500 transition-all">
                Get Free Audit
              </Link>
            </div>
            <button onClick={dismissUpsell} className="text-slate-500 hover:text-slate-300 text-sm ml-4 transition-colors">Dismiss</button>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="space-y-3">
        <h2 className="font-semibold text-white">Quick Links</h2>
        {[
          { href: '/portal/projects', label: 'View My Projects', icon: FolderOpen },
          { href: '/portal/reports', label: 'Download Reports', icon: TrendingUp },
          { href: '/portal/files', label: 'Browse Files', icon: Files },
          { href: '/portal/messages', label: 'Send a Message', icon: MessageSquare },
        ].map(link => (
          <Link key={link.href} href={link.href} className="flex items-center justify-between p-4 glass-card hover:bg-white/[0.03] transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/[0.08] rounded-lg">
                <link.icon className="h-4 w-4 text-slate-400" />
              </div>
              <span className="font-medium text-white">{link.label}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
