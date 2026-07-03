'use client'
import { useState, useEffect } from 'react'
import { Loader2, Building2 } from 'lucide-react'

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

export default function CompanySettingsPage() {
  const [form, setForm] = useState({ name: '', contact_email: '', billing_email: '', timezone: 'America/New_York', logo_url: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/company').then(r => r.json()).then(d => {
      if (d && !d.error) setForm(f => ({ ...f, ...d }))
    })
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney']

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-sky-600" />
        <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Organization Details</h2>
          <div>
            <label className={labelClass}>Organization Name *</label>
            <input className={inputClass} value={form.name} onChange={set('name')} required placeholder="Mindshare Consulting Inc." />
          </div>
          <div>
            <label className={labelClass}>Logo URL</label>
            <input className={inputClass} value={form.logo_url} onChange={set('logo_url')} placeholder="https://..." />
            <p className="text-xs text-gray-400 mt-1">Paste a direct image URL or a Google Drive image link</p>
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select className={inputClass} value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Contact Emails</h2>
          <div>
            <label className={labelClass}>Primary Contact Email</label>
            <input className={inputClass} type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="contact@youragency.com" />
          </div>
          <div>
            <label className={labelClass}>Billing Email</label>
            <input className={inputClass} type="email" value={form.billing_email} onChange={set('billing_email')} placeholder="billing@youragency.com" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        </div>
      </form>
    </div>
  )
}
