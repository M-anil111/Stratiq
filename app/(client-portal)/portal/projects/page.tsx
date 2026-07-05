'use client'
import { useEffect, useState } from 'react'
import {
  Globe,
  Search,
  Share2,
  MousePointerClick,
  TrendingUp,
  FileText,
  Link,
  LayoutGrid,
  Image,
  Calendar,
} from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  in_onboarding: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const statusLabels: Record<string, string> = {
  active: 'Active',
  hold: 'On Hold',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  completed: 'Completed',
  onboarding: 'Onboarding',
  in_onboarding: 'Onboarding',
  prospect: 'Prospect',
}

const serviceIcons: Record<string, React.ElementType> = {
  'SEO': Search,
  'Social Media': Share2,
  'PPC': MousePointerClick,
  'Google Ads': MousePointerClick,
  'Facebook Ads': MousePointerClick,
  'Content Marketing': FileText,
  'Link Building': Link,
  'Analytics': TrendingUp,
}

function ServiceIcon({ service }: { service: string }) {
  const Icon = Object.entries(serviceIcons).find(([k]) =>
    service.toLowerCase().includes(k.toLowerCase())
  )?.[1] ?? Globe
  return <Icon className="h-3.5 w-3.5" />
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white/[0.04] rounded-xl p-4 flex flex-col gap-1.5">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function PortalProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/projects')
      .then(r => r.json())
      .then(d => { setProjects(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      {[1, 2].map(i => <div key={i} className="h-64 bg-white/[0.04] rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Your Projects</h1>
        <p className="text-sm text-slate-400 mt-1">Monthly activity for {getCurrentMonthLabel()}</p>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400">
          <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No projects yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => {
            const stats = project.monthly_stats ?? {
              blog_count: 0, offpage_count: 0, onpage_count: 0, social_count: 0,
            }
            const services: string[] = project.services ?? []

            return (
              <div key={project.id} className="glass-card overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-white/[0.06]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-white text-lg leading-tight truncate">
                          {project.domain}
                        </h2>
                        {project.created_at && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            <span>Since {formatDate(project.created_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[project.status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                      {statusLabels[project.status] ?? project.status}
                    </span>
                  </div>

                  {/* Services */}
                  {services.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {services.map((s: string) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 text-sky-400 text-xs rounded-full border border-sky-500/20"
                        >
                          <ServiceIcon service={s} />
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monthly Stats */}
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    This Month&apos;s Activity
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                      label="Blog Posts"
                      value={stats.blog_count}
                      icon={FileText}
                      color="text-violet-400"
                    />
                    <StatCard
                      label="Off-Page"
                      value={stats.offpage_count}
                      icon={Link}
                      color="text-sky-400"
                    />
                    <StatCard
                      label="Social Posts"
                      value={stats.social_count}
                      icon={Image}
                      color="text-pink-400"
                    />
                    <StatCard
                      label="On-Page"
                      value={stats.onpage_count}
                      icon={LayoutGrid}
                      color="text-emerald-400"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
