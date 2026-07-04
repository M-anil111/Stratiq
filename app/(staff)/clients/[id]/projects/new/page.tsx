'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Loader2, Trash2, Lock, CheckCircle } from 'lucide-react'

const SERVICES = [
  'SEO (Local)', 'SEO (National)', 'SEO (E-commerce)', 'Content Marketing',
  'Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads',
  'Social Media Management', 'Video Marketing', 'Email Marketing',
  'Web Design & Development', 'Reputation Management', 'Link Building',
  'Graphic Design', 'Website Maintenance',
]

const TRACKING_TOOLS = [
  'Google Analytics', 'Google Tag Manager', 'Google Search Console', 'Google Ads',
  'Google Business Profile', 'Facebook Pixel', 'Facebook Business Manager', 'HubSpot', 'Other',
]

const SOCIAL_PLATFORMS = [
  'Instagram', 'Facebook', 'Twitter/X', 'LinkedIn', 'Pinterest', 'Threads',
  'Locals', 'Google Business Profile', 'Rumble', 'YouTube', 'TikTok', 'Linktree',
]

const selectGlass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function MultiSelect({ options, value, onChange }: { options: string[], value: string[], onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${value.includes(opt) ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white/[0.05] border-white/[0.12] text-slate-300 hover:border-sky-400'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 pb-4 border-b border-white/[0.08]">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function NewProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<{ id: string; domain: string } | null>(null)
  const [form, setForm] = useState({
    domain: '',
    status: 'active',
    industry: '',
    services: [] as string[],
  })
  const [trackingTools, setTrackingTools] = useState([{ tool_name: '', profile_id: '', account_email: '' }])
  const [credentials, setCredentials] = useState([{ site_name: '', username: '', password: '' }])
  const [socialAccounts, setSocialAccounts] = useState(
    SOCIAL_PLATFORMS.map(p => ({ platform: p, username: '', password: '', profile_url: '' }))
  )

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const addTrackingTool = () => setTrackingTools(t => [...t, { tool_name: '', profile_id: '', account_email: '' }])
  const removeTrackingTool = (i: number) => setTrackingTools(t => t.filter((_, idx) => idx !== i))
  const updateTrackingTool = (i: number, field: string, val: string) =>
    setTrackingTools(t => t.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const addCredential = () => setCredentials(c => [...c, { site_name: '', username: '', password: '' }])
  const removeCredential = (i: number) => setCredentials(c => c.filter((_, idx) => idx !== i))
  const updateCredential = (i: number, field: string, val: string) =>
    setCredentials(c => c.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const updateSocialAccount = (i: number, field: string, val: string) =>
    setSocialAccounts(a => a.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${params.id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tracking_tools: trackingTools, credentials, social_accounts: socialAccounts }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuccess({ id: data.id, domain: form.domain })
        setTimeout(() => router.push(`/clients/${params.id}/projects/${data.id}`), 2000)
      } else {
        alert('Error saving project.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-12 text-center animate-float-up max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Project Created Successfully!</h2>
          <p className="text-slate-300 font-medium mb-1">{success.domain}</p>
          <p className="text-slate-400 text-sm flex items-center justify-center gap-2 mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Taking you to the project dashboard...
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
      <div className="flex items-center gap-3 mb-8 animate-float-up">
        <Link href={`/clients/${params.id}`} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add New Project</h1>
          <p className="text-sm text-slate-400">Create a new project for this client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Info */}
        <div className="glass-card p-6 animate-float-up animate-delay-100">
          <SectionHeader title="Project Information" subtitle="Domain and service details for this project" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Domain Name <span className="text-red-400">*</span></label>
              <input className="input-glass" value={form.domain} onChange={setField('domain')} placeholder="example.com" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Status <span className="text-red-400">*</span></label>
              <select className={selectGlass} value={form.status} onChange={setField('status')} required>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="in_onboarding">In Onboarding</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Services Provided <span className="text-red-400">*</span></label>
              <MultiSelect options={SERVICES} value={form.services} onChange={v => setForm(f => ({ ...f, services: v }))} />
            </div>
          </div>
        </div>

        {/* Tracking Tools */}
        <div className="glass-card p-6 animate-float-up animate-delay-200">
          <SectionHeader title="Tracking Tools" subtitle="Analytics and tracking accounts for this project" />
          <div className="space-y-3">
            {trackingTools.map((tool, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <select className={selectGlass} value={tool.tool_name} onChange={e => updateTrackingTool(i, 'tool_name', e.target.value)}>
                    <option value="">Select tool…</option>
                    {TRACKING_TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="input-glass" placeholder="Profile / Property ID" value={tool.profile_id} onChange={e => updateTrackingTool(i, 'profile_id', e.target.value)} />
                  <input className="input-glass" placeholder="Account email" type="email" value={tool.account_email} onChange={e => updateTrackingTool(i, 'account_email', e.target.value)} />
                </div>
                {trackingTools.length > 1 && (
                  <button type="button" onClick={() => removeTrackingTool(i)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTrackingTool} className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 font-medium transition-colors mt-1">
              <Plus className="h-4 w-4" /> Add Tracking Tool
            </button>
          </div>
        </div>

        {/* Login Credentials */}
        <div className="glass-card p-6 animate-float-up animate-delay-300">
          <SectionHeader title="Login Credentials" subtitle="Passwords are encrypted with AES-256-GCM before storage" />
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">All passwords are encrypted end-to-end — never stored as plaintext</p>
          </div>
          <div className="space-y-3">
            {credentials.map((cred, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <input className="input-glass" placeholder="Site name (e.g. WordPress)" value={cred.site_name} onChange={e => updateCredential(i, 'site_name', e.target.value)} />
                  <input className="input-glass" placeholder="Username / Email" value={cred.username} onChange={e => updateCredential(i, 'username', e.target.value)} />
                  <input className="input-glass" type="password" placeholder="Password" value={cred.password} onChange={e => updateCredential(i, 'password', e.target.value)} />
                </div>
                {credentials.length > 1 && (
                  <button type="button" onClick={() => removeCredential(i)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addCredential} className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 font-medium transition-colors mt-1">
              <Plus className="h-4 w-4" /> Add Another Credential
            </button>
          </div>
        </div>

        {/* Social Media Accounts */}
        <div className="glass-card p-6 animate-float-up animate-delay-400">
          <SectionHeader title="Social Media Accounts" subtitle="Enter credentials for each platform" />
          <div className="space-y-2">
            {socialAccounts.map((acct, i) => (
              <div key={acct.platform} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center py-3 border-b border-white/[0.05] last:border-0">
                <span className="text-sm font-medium text-slate-300">{acct.platform}</span>
                <input className="input-glass" placeholder="@username" value={acct.username} onChange={e => updateSocialAccount(i, 'username', e.target.value)} />
                <input className="input-glass" type="password" placeholder="Password" value={acct.password} onChange={e => updateSocialAccount(i, 'password', e.target.value)} />
                <input className="input-glass" placeholder="Profile URL" value={acct.profile_url} onChange={e => updateSocialAccount(i, 'profile_url', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 justify-end pb-8">
          <Link href={`/clients/${params.id}`} className="px-6 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="btn-brand flex items-center gap-2 px-6 py-2.5 rounded-xl disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
