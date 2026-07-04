'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

const labelClass = "block text-sm font-medium text-slate-300 mb-1"
const selectGlass = "bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 w-full"

const SERVICE_OPTIONS = ['SEO', 'Google Ads', 'Meta Ads', 'Social Media Management', 'Content Writing', 'Web Design', 'Email Marketing', 'Local SEO', 'E-commerce SEO']
const STATUS_OPTIONS = ['active', 'hold', 'cancelled', 'prospect', 'onboarding', 'completed']

export default function EditClientPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    fetch(`/api/clients/${params.id}`)
      .then(r => r.json())
      .then(d => { setForm(d); setLoading(false) })
  }, [params.id])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f: any) => ({ ...f, [field]: e.target.value }))

  const toggleService = (service: string) => setForm((f: any) => ({
    ...f,
    services: f.services?.includes(service) ? f.services.filter((s: string) => s !== service) : [...(f.services || []), service],
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) router.push(`/clients/${params.id}`)
    else setSaving(false)
  }

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">Edit Client</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-white">Company Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Company Name *</label><input className="input-glass" value={form.company_name || ''} onChange={set('company_name')} required /></div>
            <div><label className={labelClass}>Website</label><input className="input-glass" value={form.website || ''} onChange={set('website')} /></div>
            <div><label className={labelClass}>Industry</label><input className="input-glass" value={form.industry || ''} onChange={set('industry')} /></div>
            <div><label className={labelClass}>Status</label>
              <select className={selectGlass} value={form.project_status || ''} onChange={set('project_status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Email</label><input className="input-glass" type="email" value={form.email || ''} onChange={set('email')} /></div>
            <div><label className={labelClass}>Phone</label><input className="input-glass" value={form.phone || ''} onChange={set('phone')} /></div>
          </div>
          <div><label className={labelClass}>About Company</label><textarea className="input-glass resize-none h-20" value={form.about_company || ''} onChange={set('about_company')} /></div>
        </div>

        {/* Address */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-white">Address</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className={labelClass}>Street Address</label><input className="input-glass" value={form.street_address || ''} onChange={set('street_address')} /></div>
            <div><label className={labelClass}>City</label><input className="input-glass" value={form.city || ''} onChange={set('city')} /></div>
            <div><label className={labelClass}>State</label><input className="input-glass" value={form.state || ''} onChange={set('state')} /></div>
            <div><label className={labelClass}>Country</label><input className="input-glass" value={form.country || ''} onChange={set('country')} /></div>
          </div>
        </div>

        {/* Services */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-3">Services</h2>
          <div className="flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggleService(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${form.services?.includes(s) ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/[0.05] text-slate-300 border-white/[0.12] hover:border-sky-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Storage */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-white">Storage & Links</h2>
          <div>
            <label className={labelClass}>Google Drive Folder URL</label>
            <input className="input-glass" value={form.google_drive_folder_url || ''} onChange={set('google_drive_folder_url')} placeholder="https://drive.google.com/..." />
          </div>
          <div>
            <label className={labelClass}>nDisk Link</label>
            <input className="input-glass" value={form.ndisk_link || ''} onChange={set('ndisk_link')} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-white/[0.08] text-slate-300 rounded-lg text-sm hover:bg-white/[0.05]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-brand flex items-center gap-2 px-6 py-2.5 disabled:opacity-60 rounded-lg text-sm font-medium">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
