'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, CheckCircle, Building2, AlertCircle } from 'lucide-react'
import AddButton from '@/components/ui/AddButton'
import ProofHubProjectPicker from '@/components/ProofHubProjectPicker'
import CustomFieldsSection from '@/components/CustomFieldsSection'
import ComboBox from '@/components/ui/ComboBox'
import MultiSelectPeople from '@/components/ui/MultiSelectPeople'

const SERVICES = [
  'SEO (Local)', 'SEO (National)', 'SEO (E-commerce)', 'Content Marketing',
  'Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads',
  'Social Media Management', 'Video Marketing', 'Email Marketing',
  'Web Design & Development', 'Reputation Management', 'Link Building',
  'Graphic Design', 'Website Maintenance',
]

const DEFAULT_STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'cancelled', 'prospect', 'in_onboarding']

const PROJECT_TYPES = [
  { key: 'marketing', label: 'Marketing', hint: 'SEO, PPC, social, content, ads' },
  { key: 'website', label: 'Website', hint: 'Design & development' },
  { key: 'mobile_app', label: 'Mobile App', hint: 'iOS / Android build' },
  { key: 'hosting', label: 'Hosting', hint: 'Servers, domains, uptime' },
  { key: 'other', label: 'Other', hint: 'Anything else' },
] as const

// Which resource-assignment slots make sense per project type. Stored as
// free-form jsonb (resource_assignments), so switching type just changes
// which keys the form shows/writes — no schema change needed per type.
const RESOURCE_FIELDS: Record<string, { key: string; label: string }[]> = {
  marketing: [
    { key: 'seo', label: 'SEO Resource' },
    { key: 'ppc', label: 'PPC Resource' },
    { key: 'content', label: 'Content Resource' },
    { key: 'video', label: 'Video Resource' },
    { key: 'social_media', label: 'Social Media Resource' },
  ],
  website: [
    { key: 'developer', label: 'Developer' },
    { key: 'designer', label: 'Designer' },
    { key: 'project_manager', label: 'Project Manager' },
  ],
  mobile_app: [
    { key: 'developer', label: 'Developer' },
    { key: 'designer', label: 'Designer' },
    { key: 'qa', label: 'QA Resource' },
  ],
  hosting: [
    { key: 'support', label: 'Support Resource' },
  ],
  other: [
    { key: 'assigned_to', label: 'Assigned To' },
  ],
}

const selectGlass = "w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

// Strip protocol / path / www so the NOT NULL domain column gets a clean value.
function normalizeDomain(raw: string): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .trim()
}

function MultiSelect({ options, value, onChange }: { options: string[], value: string[], onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${value.includes(opt) ? 'bg-sky-500 border-sky-500 text-white' : 'bg-slate-900/[0.04] dark:bg-white/[0.05] border-slate-900/10 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 hover:border-sky-400'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

interface Client {
  id: string
  company_name?: string
  display_name?: string
  website?: string
  industry?: string
  services?: string[]
  logo_url?: string
  sales_manager_id?: string
  dm_manager_id?: string
}
interface TeamUser { id: string; full_name: string }

export default function NewProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [users, setUsers] = useState<TeamUser[]>([])
  const [logoOk, setLogoOk] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: string; domain?: string }>({})
  const [success, setSuccess] = useState<{ id: string; name: string } | null>(null)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})
  // Masters-backed option lists (Settings → Masters); fall back to sane
  // defaults if a category is empty/unconfigured for this org.
  const [STATUS_OPTIONS, setStatusOptions] = useState<string[]>(DEFAULT_STATUS_OPTIONS)
  const [industryOptions, setIndustryOptions] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/settings/masters?category=project_status')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data) && data.length > 0) setStatusOptions(data.map((m: any) => m.value).filter(Boolean)) })
      .catch(() => {})
    fetch('/api/settings/masters?category=industry')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setIndustryOptions(data.map((m: any) => m.label).filter(Boolean)) })
      .catch(() => {})
  }, [])

  const [form, setForm] = useState({
    name: '',
    project_type: 'marketing' as string,
    domain: '',
    status: 'active',
    industry: '',
    services: [] as string[],
    sales_manager_id: '',
    dm_manager_id: '',
    start_date: '',
    end_date: '',
    notes: '',
    proofhub_project_id: '' as string,
  })
  const [resourceAssignments, setResourceAssignments] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const field of RESOURCE_FIELDS.marketing) init[field.key] = []
    return init
  })

  // Reset resource-assignment slots to match whichever set the current
  // project type uses, without discarding people already picked for a slot
  // that's still relevant after the switch.
  const setProjectType = (type: string) => {
    setForm(f => ({ ...f, project_type: type }))
    setResourceAssignments(prev => {
      const next: Record<string, string[]> = {}
      for (const field of RESOURCE_FIELDS[type] || []) next[field.key] = prev[field.key] || []
      return next
    })
  }

  // Load the linked client + team so we can prominently show and prefill from them.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/clients/${params.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/users').then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([c, u]) => {
      if (cancelled) return
      if (Array.isArray(u)) setUsers(u)
      if (c && c.id) {
        setClient(c)
        const company = c.display_name || c.company_name || ''
        const primary = Array.isArray(c.services) && c.services.length ? c.services[0] : ''
        setForm(f => ({
          ...f,
          name: primary ? `${company} — ${primary}` : company,
          domain: normalizeDomain(c.website || ''),
          industry: c.industry || '',
          services: Array.isArray(c.services) ? c.services.filter((s: string) => SERVICES.includes(s)) : [],
          sales_manager_id: c.sales_manager_id || '',
          dm_manager_id: c.dm_manager_id || '',
        }))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [params.id])

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const next: { name?: string; domain?: string } = {}
    if (!form.name.trim()) next.name = 'Project name is required'
    if (!normalizeDomain(form.domain)) next.domain = 'Domain is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${params.id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          domain: normalizeDomain(form.domain),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          proofhub_project_id: form.proofhub_project_id || null,
          custom_field_values: customFieldValues,
          resource_assignments: resourceAssignments,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuccess({ id: data.id, name: form.name || normalizeDomain(form.domain) })
        setTimeout(() => router.push(`/clients/${params.id}/projects/${data.id}`), 1500)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Something went wrong while creating the project. Please try again.')
      }
    } catch {
      setError('Network error — please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const company = client?.display_name || client?.company_name || 'this client'

  if (success) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-12 text-center animate-float-up max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Project Created!</h2>
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">{success.name}</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm flex items-center justify-center gap-2 mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Taking you to the project…
          </p>
          <button
            onClick={() => router.push(`/clients/${params.id}/projects/${success.id}`)}
            className="btn-brand mt-6 px-6 py-2.5 font-medium rounded-lg"
          >
            View Project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-float-up">
        <Link href={`/clients/${params.id}`} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Project</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Just a few details — we've prefilled what we can from the client.</p>
        </div>
      </div>

      {/* Linked customer banner */}
      <div className="glass-card p-5 mb-6 animate-float-up flex items-center gap-4">
        <div className="h-14 w-14 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/[0.12] flex items-center justify-center overflow-hidden shrink-0">
          {client?.logo_url && logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt={company} className="h-full w-full object-contain" onError={() => setLogoOk(false)} />
          ) : (
            <Building2 className="h-7 w-7 text-sky-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">New project for</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white truncate">{loading ? 'Loading…' : company}</p>
          {client?.website && <p className="text-sm text-sky-400 truncate">{client.website}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project type — determines which fields/resources show below */}
        <div className="glass-card p-6 animate-float-up">
          <div className="mb-5 pb-4 border-b border-slate-900/10 dark:border-white/[0.08]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What kind of project is this?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">One place to add any engagement for {company} — marketing, a website, an app, hosting, or anything else.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PROJECT_TYPES.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setProjectType(t.key)}
                className={`text-left rounded-xl border p-3 transition-colors ${form.project_type === t.key ? 'bg-sky-500/10 border-sky-500/60 ring-1 ring-sky-500/40' : 'bg-slate-900/[0.03] dark:bg-white/[0.04] border-slate-900/10 dark:border-white/[0.1] hover:border-sky-400/50'}`}
              >
                <p className={`text-sm font-semibold ${form.project_type === t.key ? 'text-sky-600 dark:text-sky-300' : 'text-slate-900 dark:text-white'}`}>{t.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {/* The essentials */}
        <div className="glass-card p-6 animate-float-up animate-delay-100">
          <div className="mb-6 pb-4 border-b border-slate-900/10 dark:border-white/[0.08]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Project Details</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">The essentials for {company}.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Project Name <span className="text-red-400">*</span></label>
              <input className="input-glass" value={form.name} onChange={setField('name')} placeholder="e.g. Acme Co — SEO (Local)" />
              {errors.name && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                {form.project_type === 'mobile_app' ? 'App / Store Listing URL' : form.project_type === 'hosting' ? 'Server / Domain' : 'Domain'} <span className="text-red-400">*</span>
              </label>
              <input className="input-glass" value={form.domain} onChange={setField('domain')} placeholder="example.com" />
              {errors.domain && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.domain}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
              <select className={selectGlass} value={form.status} onChange={setField('status')}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Industry</label>
              <ComboBox
                value={form.industry}
                onChange={(v) => setForm(f => ({ ...f, industry: v }))}
                options={industryOptions}
                placeholder="Select or type an industry…"
              />
            </div>
            {form.project_type === 'marketing' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Services</label>
                <MultiSelect options={SERVICES} value={form.services} onChange={v => setForm(f => ({ ...f, services: v }))} />
              </div>
            )}
          </div>
        </div>

        {/* Team + timeline */}
        <div className="glass-card p-6 animate-float-up animate-delay-200">
          <div className="mb-6 pb-4 border-b border-slate-900/10 dark:border-white/[0.08]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Team &amp; Timeline</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Optional — defaults come from the client's assigned managers.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Sales Manager</label>
              <select className={selectGlass} value={form.sales_manager_id} onChange={setField('sales_manager_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Development Manager</label>
              <select className={selectGlass} value={form.dm_manager_id} onChange={setField('dm_manager_id')}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
              <input type="date" className={selectGlass} value={form.start_date} onChange={setField('start_date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">End Date</label>
              <input type="date" className={selectGlass} value={form.end_date} onChange={setField('end_date')} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Notes</label>
              <textarea className="input-glass min-h-[90px]" value={form.notes} onChange={setField('notes')} placeholder="Anything the team should know about this project…" />
            </div>
          </div>
        </div>

        {/* Resource assignments */}
        <div className="glass-card p-6 animate-float-up animate-delay-200">
          <div className="mb-6 pb-4 border-b border-slate-900/10 dark:border-white/[0.08]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resource Assignments</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Optional — assign one or more team members per deliverable type.</p>
          </div>
          <div className="space-y-5">
            {(RESOURCE_FIELDS[form.project_type] || []).map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{field.label}</label>
                <MultiSelectPeople
                  options={users}
                  value={resourceAssignments[field.key] || []}
                  onChange={v => setResourceAssignments(r => ({ ...r, [field.key]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ProofHub */}
        <div className="glass-card p-6 animate-float-up animate-delay-200">
          <div className="mb-6 pb-4 border-b border-slate-900/10 dark:border-white/[0.08]">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">ProofHub</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Optionally link this project to a ProofHub project, or create a new one.</p>
          </div>
          <ProofHubProjectPicker
            value={form.proofhub_project_id || null}
            onChange={(id) => setForm(f => ({ ...f, proofhub_project_id: id || '' }))}
            defaultName={form.name}
          />
        </div>

        <CustomFieldsSection entityType="project" values={customFieldValues} onChange={setCustomFieldValues} />

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4 justify-end pb-8">
          <Link href={`/clients/${params.id}`} className="px-6 py-2.5 border border-slate-900/10 dark:border-white/[0.08] rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/[0.05] transition-colors">
            Cancel
          </Link>
          <AddButton
            type="submit"
            disabled={saving}
            label={saving ? 'Creating…' : 'Create Project'}
            icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          />
        </div>
      </form>
    </div>
  )
}
