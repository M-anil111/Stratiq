'use client'

import { useState, useEffect } from 'react'
import CredentialsTab from './CredentialsTab'
import TrackingToolsTab from './TrackingToolsTab'
import SocialAccountsTab from './SocialAccountsTab'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'
import ResourceAssignmentsEditor from '@/components/ResourceAssignmentsEditor'
import { Loader2, Globe, Briefcase } from 'lucide-react'

const RESOURCE_LABELS: { key: string; label: string }[] = [
  { key: 'seo', label: 'SEO' },
  { key: 'ppc', label: 'PPC' },
  { key: 'content', label: 'Content' },
  { key: 'video', label: 'Video' },
  { key: 'social_media', label: 'Social Media' },
  { key: 'developer', label: 'Developer' },
  { key: 'designer', label: 'Designer' },
  { key: 'project_manager', label: 'Project Manager' },
  { key: 'qa', label: 'QA' },
  { key: 'support', label: 'Support' },
  { key: 'assigned_to', label: 'Assigned To' },
]

const PROJECT_TYPE_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  website: 'Website',
  mobile_app: 'Mobile App',
  hosting: 'Hosting',
  other: 'Other',
}

const TABS = ['Project Info', 'Submission Details', 'Reporting', 'Files', 'Credentials', 'Tracking Tools', 'Social Accounts']

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  paused: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  completed: 'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/25',
}

// HubSpot-record-style property row: label left, value right, hairline
// divider between rows instead of a box-per-fact grid.
function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-slate-900/[0.06] dark:border-white/[0.05] last:border-b-0">
      <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 shrink-0 w-40">{label}</span>
      <div className="flex-1 min-w-0 text-[13.5px] text-slate-800 dark:text-slate-200 text-right">{children}</div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function ProjectInfoTab({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])

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

  useEffect(() => {
    fetch('/api/users')
      .then(r => (r.ok ? r.json() : []))
      .then(u => { if (Array.isArray(u)) setUsers(u) })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading project…
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-6 text-center text-slate-600 dark:text-slate-400">
        <p className="font-medium text-red-400">{error || 'Project not found'}</p>
      </div>
    )
  }

  const statusKey = (project.status || '').toLowerCase()
  const credCount = project.login_credentials?.length ?? 0
  const socialCount = project.social_media_accounts?.length ?? 0
  const trackingCount = project.tracking_tools?.length ?? 0

  const activeResources = RESOURCE_LABELS.filter(({ key }) => (project.resource_assignments?.[key] || []).length > 0)

  return (
    <div className="p-6 space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Briefcase className="h-5 w-5 text-sky-500 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[22px] leading-tight font-semibold tracking-tight text-slate-900 dark:text-white truncate">
              {project.name || project.domain || 'Untitled Project'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">{PROJECT_TYPE_LABELS[project.project_type] || 'Marketing'}</span>
              {project.industry && <><span className="text-slate-300 dark:text-slate-600">·</span><span>{project.industry}</span></>}
              {project.created_at && <><span className="text-slate-300 dark:text-slate-600">·</span><span className="tabular-nums">Created {formatDate(project.created_at)}</span></>}
            </div>
          </div>
        </div>
        {project.status && (
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize whitespace-nowrap tracking-wide ${statusColors[statusKey] || 'bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300'}`}>
            {project.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Properties panel — HubSpot-style label/value rows instead of a fact grid */}
      <div className="rounded-xl border border-slate-900/[0.07] dark:border-white/[0.07] bg-white/60 dark:bg-white/[0.02] px-4">
        <PropertyRow label="Domain">
          {project.domain ? (
            <a
              href={project.domain.startsWith('http') ? project.domain : `https://${project.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {project.domain}
            </a>
          ) : <span className="text-slate-400 dark:text-slate-500">—</span>}
        </PropertyRow>

        {project.services && project.services.length > 0 && (
          <PropertyRow label="Services">
            <div className="flex flex-wrap justify-end gap-1.5">
              {project.services.map((s: string) => (
                <span key={s} className="px-2 py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-medium rounded-md border border-sky-500/20">{s}</span>
              ))}
            </div>
          </PropertyRow>
        )}

        {activeResources.map(({ key, label }) => {
          const assignments = project.resource_assignments?.[key]
          if (!Array.isArray(assignments)) return null
          return (
            <PropertyRow key={key} label={label}>
              <div className="flex flex-wrap justify-end gap-1.5">
                {assignments.map((uid: string) => {
                  const name = users.find(u => u.id === uid)?.full_name || uid
                  return (
                    <span key={uid} className="px-2 py-0.5 bg-slate-900/[0.05] dark:bg-white/[0.07] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-md">{name}</span>
                  )
                })}
              </div>
            </PropertyRow>
          )
        })}

        {project.goals && (
          <PropertyRow label="Goals">
            <span className="text-slate-700 dark:text-slate-300">{project.goals}</span>
          </PropertyRow>
        )}
      </div>

      <CustomFieldsEditor
        entityType="project"
        patchUrl={`/api/projects/${projectId}`}
        initialValues={project.custom_field_values}
        onSaved={(values) => setProject((p: any) => ({ ...p, custom_field_values: values }))}
      />

      <ResourceAssignmentsEditor
        patchUrl={`/api/projects/${projectId}`}
        initialValue={project.resource_assignments}
        projectType={project.project_type}
        onSaved={(value) => setProject((p: any) => ({ ...p, resource_assignments: value }))}
      />

      {/* Stats */}
      <div>
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">Stored Data</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Credentials', value: credCount },
            { label: 'Social Accounts', value: socialCount },
            { label: 'Tracking Tools', value: trackingCount },
          ].map(({ label, value }) => (
            <div key={label} className="p-3.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-900/[0.07] dark:border-white/[0.07]">
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
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
      <div className="flex border-b border-slate-900/10 dark:border-white/[0.08] overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-[13.5px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              i === activeTab
                ? 'text-slate-900 dark:text-white border-sky-500'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
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
        <div className="p-6 text-center text-slate-600 dark:text-slate-400">
          <p className="font-medium">This tab is not yet implemented.</p>
          <p className="text-sm mt-1">Connect your Supabase database and configure environment variables to enable data loading.</p>
        </div>
      )}
    </div>
  )
}
