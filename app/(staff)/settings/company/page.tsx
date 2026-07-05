'use client'
import { useState, useEffect } from 'react'
import { Loader2, Building2 } from 'lucide-react'

const labelClass = "block text-sm font-medium text-slate-300 mb-1"

const INITIAL_FORM = {
  name: '',
  contact_email: '',
  billing_email: '',
  timezone: 'America/New_York',
  logo_url: '',
  website: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney',
]

export default function CompanySettingsPage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/company')
      .then(r => (r.ok ? r.json() : ({} as Record<string, unknown>)))
      .then((d: Record<string, unknown>) => { if (d && !d.error) setForm(f => ({ ...f, ...(d as typeof INITIAL_FORM) })) })
      .catch(() => {})
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to save')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Network error — please try again')
    }
    setSaving(false)
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-sky-400" />
        <h1 className="text-2xl font-bold text-white">Company Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization Details */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-white">Organization Details</h2>
          <div>
            <label className={labelClass}>Organization Name *</label>
            <input className="input-glass" value={form.name} onChange={set('name')} required placeholder="Mindshare Consulting Inc." />
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input className="input-glass" type="url" value={form.website} onChange={set('website')} placeholder="https://yourwebsite.com" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className="input-glass" type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
          </div>
          <div>
            <label className={labelClass}>Logo URL</label>
            <input className="input-glass" value={form.logo_url} onChange={set('logo_url')} placeholder="https://..." />
            <p className="text-xs text-slate-400 mt-1">Paste a direct image URL or a Google Drive image link</p>
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select
              className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 w-full"
              value={form.timezone}
              onChange={set('timezone')}
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        {/* Address */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-white">Address</h2>
          <div>
            <label className={labelClass}>Street Address</label>
            <input className="input-glass" value={form.address} onChange={set('address')} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>City</label>
              <input className="input-glass" value={form.city} onChange={set('city')} placeholder="New York" />
            </div>
            <div>
              <label className={labelClass}>State / Province</label>
              <input className="input-glass" value={form.state} onChange={set('state')} placeholder="NY" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Postcode / ZIP</label>
              <input className="input-glass" value={form.postcode} onChange={set('postcode')} placeholder="10001" />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input className="input-glass" value={form.country} onChange={set('country')} placeholder="United States" />
            </div>
          </div>
        </div>

        {/* Contact Emails */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-white">Contact Emails</h2>
          <div>
            <label className={labelClass}>Primary Contact Email</label>
            <input className="input-glass" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="contact@youragency.com" />
          </div>
          <div>
            <label className={labelClass}>Billing Email</label>
            <input className="input-glass" type="email" value={form.billing_email} onChange={set('billing_email')} placeholder="billing@youragency.com" />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-brand flex items-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-400 font-medium">✓ Saved</span>}
        </div>
      </form>
    </div>
  )
}
