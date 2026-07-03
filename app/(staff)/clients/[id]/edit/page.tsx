'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

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
      {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Client</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Company Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Company Name *</label><input className={inputClass} value={form.company_name || ''} onChange={set('company_name')} required /></div>
            <div><label className={labelClass}>Website</label><input className={inputClass} value={form.website || ''} onChange={set('website')} /></div>
            <div><label className={labelClass}>Industry</label><input className={inputClass} value={form.industry || ''} onChange={set('industry')} /></div>
            <div><label className={labelClass}>Status</label>
              <select className={inputClass} value={form.project_status || ''} onChange={set('project_status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Email</label><input className={inputClass} type="email" value={form.email || ''} onChange={set('email')} /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.phone || ''} onChange={set('phone')} /></div>
          </div>
          <div><label className={labelClass}>About Company</label><textarea className={`${inputClass} resize-none h-20`} value={form.about_company || ''} onChange={set('about_company')} /></div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Address</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className={labelClass}>Street Address</label><input className={inputClass} value={form.street_address || ''} onChange={set('street_address')} /></div>
            <div><label className={labelClass}>City</label><input className={inputClass} value={form.city || ''} onChange={set('city')} /></div>
            <div><label className={labelClass}>State</label><input className={inputClass} value={form.state || ''} onChange={set('state')} /></div>
            <div><label className={labelClass}>Country</label><input className={inputClass} value={form.country || ''} onChange={set('country')} /></div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Services</h2>
          <div className="flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggleService(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${form.services?.includes(s) ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-gray-700 border-gray-300 hover:border-sky-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Storage & Links</h2>
          <div>
            <label className={labelClass}>Google Drive Folder URL</label>
            <input className={inputClass} value={form.google_drive_folder_url || ''} onChange={set('google_drive_folder_url')} placeholder="https://drive.google.com/..." />
          </div>
          <div>
            <label className={labelClass}>nDisk Link</label>
            <input className={inputClass} value={form.ndisk_link || ''} onChange={set('ndisk_link')} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
