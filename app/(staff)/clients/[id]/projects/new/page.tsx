'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Loader2, Trash2 } from 'lucide-react'

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

function MultiSelect({ options, value, onChange }: { options: string[], value: string[], onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${value.includes(opt) ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-sky-400'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
const selectClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

export default function NewProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
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
        router.push(`/clients/${params.id}/projects/${data.id}`)
      } else {
        alert('Error saving project.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/clients/${params.id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Project</h1>
          <p className="text-sm text-gray-500">Create a new project for this client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Project Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-4 border-b border-gray-200">Project Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain Name <span className="text-red-500">*</span></label>
              <input className={inputClass} value={form.domain} onChange={setField('domain')} placeholder="example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
              <select className={selectClass} value={form.status} onChange={setField('status')} required>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="in_onboarding">In Onboarding</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Services Provided <span className="text-red-500">*</span></label>
              <MultiSelect options={SERVICES} value={form.services} onChange={v => setForm(f => ({ ...f, services: v }))} />
            </div>
          </div>
        </div>

        {/* Tracking Tools */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-4 border-b border-gray-200">Tracking Tools</h2>
          <div className="space-y-4">
            {trackingTools.map((tool, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <select className={selectClass} value={tool.tool_name} onChange={e => updateTrackingTool(i, 'tool_name', e.target.value)}>
                    <option value="">Select tool...</option>
                    {TRACKING_TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={inputClass} placeholder="Profile / Property ID" value={tool.profile_id} onChange={e => updateTrackingTool(i, 'profile_id', e.target.value)} />
                  <input className={inputClass} placeholder="Account email" type="email" value={tool.account_email} onChange={e => updateTrackingTool(i, 'account_email', e.target.value)} />
                </div>
                {trackingTools.length > 1 && (
                  <button type="button" onClick={() => removeTrackingTool(i)} className="p-2 text-red-400 hover:text-red-600 mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTrackingTool} className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-medium">
              <Plus className="h-4 w-4" /> Add Tracking Tool
            </button>
          </div>
        </div>

        {/* Login Credentials */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 pb-4 border-b border-gray-200">Login Credentials</h2>
          <p className="text-sm text-gray-500 mb-4">Passwords are encrypted with AES-256-GCM before storage</p>
          <div className="space-y-4">
            {credentials.map((cred, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <input className={inputClass} placeholder="Site name (e.g. WordPress)" value={cred.site_name} onChange={e => updateCredential(i, 'site_name', e.target.value)} />
                  <input className={inputClass} placeholder="Username / Email" value={cred.username} onChange={e => updateCredential(i, 'username', e.target.value)} />
                  <input className={inputClass} type="password" placeholder="Password" value={cred.password} onChange={e => updateCredential(i, 'password', e.target.value)} />
                </div>
                {credentials.length > 1 && (
                  <button type="button" onClick={() => removeCredential(i)} className="p-2 text-red-400 hover:text-red-600 mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addCredential} className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-medium">
              <Plus className="h-4 w-4" /> Add Another Credential
            </button>
          </div>
        </div>

        {/* Social Media Accounts */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-4 border-b border-gray-200">Social Media Accounts</h2>
          <div className="space-y-3">
            {socialAccounts.map((acct, i) => (
              <div key={acct.platform} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center pb-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 w-32 shrink-0">{acct.platform}</span>
                </div>
                <input className={inputClass} placeholder="@username" value={acct.username} onChange={e => updateSocialAccount(i, 'username', e.target.value)} />
                <input className={inputClass} type="password" placeholder="Password" value={acct.password} onChange={e => updateSocialAccount(i, 'password', e.target.value)} />
                <input className={inputClass} placeholder="Profile URL" value={acct.profile_url} onChange={e => updateSocialAccount(i, 'profile_url', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 justify-end pb-8">
          <Link href={`/clients/${params.id}`} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-medium rounded-lg">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
