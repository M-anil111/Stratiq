'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, X, Loader2 } from 'lucide-react'

const SERVICES = [
  'SEO (Local)', 'SEO (National)', 'SEO (E-commerce)', 'Content Marketing',
  'Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads',
  'Social Media Management', 'Video Marketing', 'Email Marketing',
  'Web Design & Development', 'Reputation Management', 'Link Building',
  'Graphic Design', 'Website Maintenance',
]

const INDUSTRIES = [
  'Restaurant / Food & Beverage', 'Retail / E-commerce', 'Healthcare / Medical',
  'Legal / Law Firm', 'Real Estate', 'Construction / Contractor',
  'Finance / Accounting', 'Technology / SaaS', 'Education', 'Non-Profit',
  'Automotive', 'Beauty / Salon / Spa', 'Entertainment / Events',
  'Travel / Hospitality', 'Home Services / Plumbing / HVAC', 'Other',
]

const GOALS = [
  'Increase Website Traffic', 'Generate Leads', 'Improve Local Search Rankings',
  'Improve National Search Rankings', 'Brand Awareness', 'Social Media Growth',
  'Increase Online Sales / Revenue', 'Improve Online Reputation', 'Product Launch', 'Event Promotion',
]

const STAKEHOLDER_EXPECTATIONS = [
  'Monthly Ranking Report', 'Monthly Traffic Report', 'Monthly Leads Report',
  'Bi-weekly Check-in Call', 'Weekly Status Update Email', 'Quarterly Strategy Review',
  'Monthly Social Media Report', 'Custom Dashboard Access',
]

const ADVERTISING_TYPES = [
  'Google Search Ads', 'Google Display Ads', 'Google Shopping Ads', 'Google Video Ads (YouTube)',
  'Facebook Ads', 'Instagram Ads', 'LinkedIn Ads', 'TikTok Ads', 'Pinterest Ads',
  'Retargeting / Remarketing', 'Programmatic Display', 'Connected TV (CTV)',
]

const ADS_SERVICES = ['Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads']

function MultiSelect({ options, value, onChange, label }: { options: string[], value: string[], onChange: (v: string[]) => void, label: string }) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            value.includes(opt)
              ? 'bg-sky-500 border-sky-500 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-sky-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function TagInput({ value, onChange, placeholder }: { value: string[], onChange: (v: string[]) => void, placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = (tag: string) => {
    const t = tag.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
  }
  return (
    <div className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-sky-500">
      {value.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-sm">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
        onBlur={() => { if (input.trim()) add(input) }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 pb-4 border-b border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
const selectClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: '', website: '', about_company: '', industry: '',
    email: '', phone: '', street_address: '', city: '', state: '', country: 'US',
    num_employees: '', hashtags: [] as string[], categories: [] as string[],
    project_status: 'active', services: [] as string[], advertising_types: [] as string[],
    goals: [] as string[], stakeholder_expectations: [] as string[], target_audience: '',
    ndisk_link: '', google_drive_folder_url: '', website_last_updated: '',
  })

  const showAdsSection = form.services.some(s => ADS_SERVICES.includes(s))

  const set = (field: string) => (value: any) => setForm(f => ({ ...f, [field]: value }))
  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/clients/${data.id}`)
      } else {
        alert('Error saving client. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clients" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Client</h1>
          <p className="text-sm text-gray-500">Fill in the details below to onboard a new client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Section 1: Company Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeader title="Company Information" subtitle="Basic details about the client's business" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Company Name" required>
              <input className={inputClass} value={form.company_name} onChange={setField('company_name')} placeholder="Acme Corporation" required />
            </Field>
            <Field label="Website / Domain" required hint="Enter domain only: example.com">
              <input className={inputClass} value={form.website} onChange={setField('website')} placeholder="example.com" required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="About Company" required>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={form.about_company}
                  onChange={setField('about_company')}
                  placeholder="Describe what this company does, their target market, and key differentiators..."
                  required
                />
              </Field>
            </div>
            <Field label="Industry" required>
              <select className={selectClass} value={form.industry} onChange={setField('industry')} required>
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Number of Employees" required>
              <input className={inputClass} type="number" value={form.num_employees} onChange={setField('num_employees')} placeholder="50" min="1" required />
            </Field>
            <Field label="Email Address" required>
              <input className={inputClass} type="email" value={form.email} onChange={setField('email')} placeholder="contact@example.com" required />
            </Field>
            <Field label="Phone Number" required>
              <input className={inputClass} value={form.phone} onChange={setField('phone')} placeholder="(512) 621-8822" required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Street Address" required>
                <input className={inputClass} value={form.street_address} onChange={setField('street_address')} placeholder="123 Main Street" required />
              </Field>
            </div>
            <Field label="City" required>
              <input className={inputClass} value={form.city} onChange={setField('city')} placeholder="Austin" required />
            </Field>
            <Field label="State" required>
              <input className={inputClass} value={form.state} onChange={setField('state')} placeholder="TX" required />
            </Field>
            <Field label="Country" required>
              <select className={selectClass} value={form.country} onChange={setField('country')} required>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="IN">India</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Relevant Hashtags" required hint="Type a hashtag and press Enter">
                <TagInput value={form.hashtags} onChange={set('hashtags')} placeholder="#localrestaurant, #austin" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Business Categories" required hint="Type and press Enter">
                <TagInput value={form.categories} onChange={set('categories')} placeholder="Italian Restaurant, Fine Dining" />
              </Field>
            </div>
          </div>
        </div>

        {/* Section 2: Services & Status */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeader title="Services & Status" subtitle="What services are provided and current project status" />
          <div className="space-y-5">
            <Field label="Project Status" required>
              <select className={selectClass} value={form.project_status} onChange={setField('project_status')} required>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="in_onboarding">In Onboarding</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Services Provided" required>
              <MultiSelect options={SERVICES} value={form.services} onChange={set('services')} label="Services" />
            </Field>
            {showAdsSection && (
              <Field label="Advertising Types">
                <MultiSelect options={ADVERTISING_TYPES} value={form.advertising_types} onChange={set('advertising_types')} label="Ad Types" />
              </Field>
            )}
            <Field label="Goal of Project" required>
              <MultiSelect options={GOALS} value={form.goals} onChange={set('goals')} label="Goals" />
            </Field>
            <Field label="Stakeholders Expectation" required>
              <MultiSelect options={STAKEHOLDER_EXPECTATIONS} value={form.stakeholder_expectations} onChange={set('stakeholder_expectations')} label="Expectations" />
            </Field>
            <Field label="Target Audience" required hint="Describe who this client targets (e.g. Young professionals 25-40, Austin TX)">
              <input className={inputClass} value={form.target_audience} onChange={setField('target_audience')} placeholder="Young professionals 25-40, Austin TX area" required />
            </Field>
          </div>
        </div>

        {/* Section 3: Storage & Links */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <SectionHeader title="Storage & Links" subtitle="Optional links to client files and resources" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="NDisk Link">
              <input className={inputClass} value={form.ndisk_link} onChange={setField('ndisk_link')} placeholder="\\\\server\\client-name" />
            </Field>
            <Field label="Google Drive Folder URL">
              <input className={inputClass} value={form.google_drive_folder_url} onChange={setField('google_drive_folder_url')} placeholder="https://drive.google.com/drive/folders/..." />
            </Field>
            <Field label="Website Last Updated" hint="Leave blank if unknown">
              <input className={inputClass} type="date" value={form.website_last_updated} onChange={setField('website_last_updated')} />
            </Field>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 justify-end pb-8">
          <Link href="/clients" className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Create Client'}
          </button>
        </div>
      </form>
    </div>
  )
}
