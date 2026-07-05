'use client'

import { useState, useEffect } from 'react'
import CredentialsTab from './CredentialsTab'
import TrackingToolsTab from './TrackingToolsTab'
import SocialAccountsTab from './SocialAccountsTab'
import { Loader2, Calendar, Tag, Globe } from 'lucide-react'

const TABS = ['Project Info', 'Submission Details', 'Reporting', 'Files', 'Credentials', 'Tracking Tools', 'Social Accounts']

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  paused: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  completed: 'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/25',
}

function ProjectInfoTab({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setProject(data)
      })
      .catch(() => setError('Failed to load project'))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading project…
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p className="font-medium text-red-400">{error || 'Project not found'}</p>
      </div>
    )
  }

  const statusKey = (project.status || '').toLowerCase()
  const credCount = project.login_credentials?.length ?? 0
  const socialCount = project.social_media_accounts?.length ?? 0
  const trackingCount = project.tracking_tools?.length ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Name + status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{project.domain || project.name || 'Untitled Project'}</h2>
          {project.industry && (
            <p className="text-sm text-slate-400 mt-0.5">{project.industry}</p>
          )}
        </div>
        {project.status && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${statusColors[statusKey] || 'bg-white/[0.06] text-slate-300'}`}>
            {project.status}
          </span>
        )}
      </div>

      {/* Key details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {project.created_at && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Calendar className="h-4 w-4 text-sky-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Start Date</p>
              <p className="text-sm font-medium text-slate-200">
                {new Date(project.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        )}
        {project.domain && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Globe className="h-4 w-4 text-sky-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Domain</p>
              <a
                href={project.domain.startsWith('http') ? project.domain : `https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors"
              >
                {project.domain}
              </a>
            </div>
          </div>
        )}
        {project.services && project.services.length > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] sm:col-span-2">
            <Tag className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Services</p>
              <div className="flex flex-wrap gap-1.5">
                {project.services.map((s: string) => (
                  <span key={s} className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-xs rounded-full border border-sky-500/20">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        {project.goals && (
          <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] sm:col-span-2">
            <p className="text-xs text-slate-500 mb-1">Goals</p>
            <p className="text-sm text-slate-300">{project.goals}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Stored Data</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Credentials', value: credCount },
            { label: 'Social Accounts', value: socialCount },
            { label: 'Tracking Tools', value: trackingCount },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-center">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProjectTabs({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="glass-card">
      <div className="flex border-b border-white/[0.08] overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              i === activeTab
                ? 'bg-white/[0.08] text-white border-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 ? (
        <ProjectInfoTab projectId={projectId} />
      ) : activeTab === 4 ? (
        <CredentialsTab projectId={projectId} />
      ) : activeTab === 5 ? (
        <TrackingToolsTab projectId={projectId} />
      ) : activeTab === 6 ? (
        <SocialAccountsTab projectId={projectId} />
      ) : (
        <div className="p-6 text-center text-slate-400">
          <p className="font-medium">This tab is not yet implemented.</p>
          <p className="text-sm mt-1">Connect your Supabase database and configure environment variables to enable data loading.</p>
        </div>
      )}
    </div>
  )
}
