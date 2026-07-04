'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Check, Loader2, CheckCircle, X,
  Building2, Briefcase, Target, ClipboardList, Search, DollarSign,
  AlertCircle,
} from 'lucide-react'

const INDUSTRIES = [
  'Restaurant / Food & Beverage', 'Retail / E-commerce', 'Healthcare / Medical',
  'Legal / Law Firm', 'Real Estate', 'Construction / Contractor',
  'Finance / Accounting', 'Technology / SaaS', 'Consulting / Professional Services',
  'Education', 'Non-Profit', 'Automotive', 'Beauty / Salon / Spa',
  'Entertainment / Events', 'Travel / Hospitality', 'Home Services / Plumbing / HVAC', 'Other',
]

const SERVICES = [
  'SEO (Local)', 'SEO (National)', 'SEO (E-commerce)', 'Content Marketing',
  'Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads',
  'Social Media Management', 'Video Marketing', 'Email Marketing',
  'Web Design & Development', 'Reputation Management', 'Link Building',
  'Graphic Design', 'Website Maintenance',
]

// Services that require Goals & Expectations to be filled in
const MARKETING_SERVICES = new Set([
  'SEO (Local)', 'SEO (National)', 'SEO (E-commerce)', 'Content Marketing',
  'Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads',
  'Social Media Management', 'Video Marketing', 'Email Marketing',
  'Reputation Management', 'Link Building',
])

const DOMAIN_REGISTRARS = ['GoDaddy', 'Namecheap', 'Google Domains', 'Cloudflare', 'Network Solutions', 'Hover', 'NameSilo', 'Porkbun', 'Other']
const HOSTING_PROVIDERS = ['SiteGround', 'WP Engine', 'Bluehost', 'HostGator', 'Kinsta', 'Cloudflare Pages', 'Vercel', 'Netlify', 'AWS', 'DigitalOcean', 'GoDaddy Hosting', 'DreamHost', 'Other']

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

const BILLING_TERMS = ['Monthly', 'Quarterly', 'Annual', 'One-time']
const CONTRACT_TERMS = ['Month-to-month', '3 Months', '6 Months', '12 Months', '24 Months']
const SM_PLATFORMS = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Twitter / X', 'Pinterest', 'YouTube', 'Snapchat']
const AD_CAMPAIGN_TYPES = ['Search', 'Display', 'Shopping', 'Video / YouTube', 'Performance Max', 'App Campaigns']
const GROUP_TYPES = ['Facebook Groups', 'LinkedIn Groups', 'Reddit', 'Nextdoor', 'Discord', 'Telegram', 'WhatsApp', 'Other']
const LINK_TYPES = ['Guest Posts', 'Citations / Directories', 'HARO / PR Links', 'Niche Edits', 'Social Bookmarks']
const EMAIL_TYPES = ['Newsletter', 'Drip Campaign', 'Promotional Blasts', 'Abandoned Cart', 'Welcome Series']

interface DeliverableField {
  key: string; label: string
  type: 'number' | 'select' | 'multiselect' | 'text' | 'tags'
  options?: string[]; placeholder?: string; hint?: string
}

const SERVICE_DELIVERABLES: Record<string, DeliverableField[]> = {
  'SEO (Local)': [
    { key: 'blog_posts_month', label: 'Blog Posts / Month', type: 'number', placeholder: '4' },
    { key: 'onpage_month', label: 'On-Page Optimizations / Month', type: 'number', placeholder: '5' },
    { key: 'offpage_month', label: 'Off-Page Submissions / Month', type: 'number', placeholder: '20' },
    { key: 'gbp_optimization', label: 'Google Business Profile Management', type: 'select', options: ['Yes', 'No'] },
    { key: 'target_keywords', label: 'Target Keywords', type: 'tags', hint: 'Press Enter after each keyword' },
  ],
  'SEO (National)': [
    { key: 'blog_posts_month', label: 'Blog Posts / Month', type: 'number', placeholder: '8' },
    { key: 'onpage_month', label: 'On-Page Optimizations / Month', type: 'number', placeholder: '8' },
    { key: 'offpage_month', label: 'Link Building Submissions / Month', type: 'number', placeholder: '30' },
    { key: 'target_keywords', label: 'Target Keywords', type: 'tags', hint: 'Press Enter after each keyword' },
  ],
  'SEO (E-commerce)': [
    { key: 'blog_posts_month', label: 'Blog Posts / Month', type: 'number', placeholder: '6' },
    { key: 'product_pages_month', label: 'Product Page Optimizations / Month', type: 'number', placeholder: '10' },
    { key: 'offpage_month', label: 'Link Building Submissions / Month', type: 'number', placeholder: '25' },
    { key: 'platform', label: 'E-commerce Platform', type: 'select', options: ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Custom', 'Other'] },
    { key: 'target_keywords', label: 'Target Keywords', type: 'tags', hint: 'Press Enter after each keyword' },
  ],
  'Content Marketing': [
    { key: 'blog_posts_month', label: 'Blog Posts / Month', type: 'number', placeholder: '8' },
    { key: 'word_count', label: 'Target Word Count per Post', type: 'select', options: ['500-800 words', '800-1200 words', '1500-2000 words', '2000+ words'] },
    { key: 'content_types', label: 'Content Types', type: 'multiselect', options: ['Blog Posts', 'Infographics', 'Case Studies', 'White Papers', 'Press Releases', 'Video Scripts'] },
  ],
  'Google Ads / PPC': [
    { key: 'monthly_ad_budget', label: 'Monthly Ad Budget ($)', type: 'number', placeholder: '2000', hint: 'Client spend on ads (not management fee)' },
    { key: 'campaign_types', label: 'Campaign Types', type: 'multiselect', options: AD_CAMPAIGN_TYPES },
    { key: 'num_campaigns', label: 'Number of Campaigns', type: 'number', placeholder: '3' },
    { key: 'target_cpa', label: 'Target CPA / Cost per Lead ($)', type: 'number', placeholder: '50' },
  ],
  'Meta Ads (Facebook & Instagram)': [
    { key: 'monthly_ad_budget', label: 'Monthly Ad Budget ($)', type: 'number', placeholder: '1500', hint: 'Client spend on ads (not management fee)' },
    { key: 'platforms', label: 'Platforms', type: 'multiselect', options: ['Facebook', 'Instagram', 'Audience Network', 'Messenger'] },
    { key: 'ad_types', label: 'Ad Formats', type: 'multiselect', options: ['Image Ads', 'Video Ads', 'Carousel', 'Stories', 'Lead Gen Forms', 'Retargeting'] },
  ],
  'LinkedIn Ads': [
    { key: 'monthly_ad_budget', label: 'Monthly Ad Budget ($)', type: 'number', placeholder: '2000' },
    { key: 'ad_types', label: 'Ad Types', type: 'multiselect', options: ['Sponsored Content', 'Message Ads', 'Lead Gen Forms', 'Dynamic Ads', 'Text Ads'] },
    { key: 'target_audience_desc', label: 'Target Job Titles / Industries', type: 'text', placeholder: 'e.g. CFOs in Healthcare' },
  ],
  'TikTok Ads': [
    { key: 'monthly_ad_budget', label: 'Monthly Ad Budget ($)', type: 'number', placeholder: '1000' },
    { key: 'ad_types', label: 'Ad Formats', type: 'multiselect', options: ['In-Feed Ads', 'TopView', 'Brand Takeover', 'Branded Hashtag Challenge', 'Spark Ads'] },
  ],
  'Social Media Management': [
    { key: 'platforms', label: 'Platforms', type: 'multiselect', options: SM_PLATFORMS },
    { key: 'posts_per_week', label: 'Posts / Week', type: 'number', placeholder: '5' },
    { key: 'stories_per_week', label: 'Stories / Week', type: 'number', placeholder: '7' },
    { key: 'reels_per_month', label: 'Reels / Videos per Month', type: 'number', placeholder: '4' },
    { key: 'group_postings_month', label: 'Group Postings / Month', type: 'number', placeholder: '10' },
    { key: 'group_types', label: 'Group Types', type: 'multiselect', options: GROUP_TYPES },
  ],
  'Video Marketing': [
    { key: 'videos_per_month', label: 'Videos / Month', type: 'number', placeholder: '4' },
    { key: 'video_types', label: 'Video Types', type: 'multiselect', options: ['YouTube', 'Short-form (Reels/TikTok)', 'Testimonials', 'Explainer', 'Product Demo', 'Social Ads'] },
    { key: 'video_length', label: 'Avg Video Length', type: 'select', options: ['Under 60s (short-form)', '1-3 minutes', '3-10 minutes', '10+ minutes'] },
  ],
  'Email Marketing': [
    { key: 'emails_per_month', label: 'Emails / Month', type: 'number', placeholder: '4' },
    { key: 'email_types', label: 'Email Types', type: 'multiselect', options: EMAIL_TYPES },
    { key: 'platform', label: 'Email Platform', type: 'select', options: ['Mailchimp', 'Klaviyo', 'HubSpot', 'ActiveCampaign', 'Constant Contact', 'Other'] },
    { key: 'list_size', label: 'Estimated List Size', type: 'number', placeholder: '2000' },
  ],
  'Web Design & Development': [
    { key: 'project_type', label: 'Project Type', type: 'multiselect', options: ['New Website', 'Redesign', 'Landing Page', 'E-commerce Build'] },
    { key: 'num_pages', label: 'Number of Pages', type: 'number', placeholder: '10' },
    { key: 'platform', label: 'Platform / CMS', type: 'select', options: ['WordPress', 'Shopify', 'Webflow', 'Squarespace', 'Wix', 'Custom / React', 'Other'] },
    { key: 'timeline_weeks', label: 'Estimated Timeline (weeks)', type: 'number', placeholder: '8' },
  ],
  'Reputation Management': [
    { key: 'review_platforms', label: 'Platforms to Monitor', type: 'multiselect', options: ['Google', 'Yelp', 'Facebook', 'TripAdvisor', 'G2', 'Trustpilot', 'BBB', 'Other'] },
    { key: 'response_time', label: 'Review Response Time', type: 'select', options: ['Within 24 hours', 'Within 48 hours', 'Weekly batch'] },
    { key: 'monthly_reviews_target', label: 'Monthly New Reviews Target', type: 'number', placeholder: '10' },
  ],
  'Link Building': [
    { key: 'links_per_month', label: 'Links / Month', type: 'number', placeholder: '10' },
    { key: 'link_types', label: 'Link Types', type: 'multiselect', options: LINK_TYPES },
    { key: 'min_da', label: 'Minimum Domain Authority', type: 'number', placeholder: '30' },
  ],
  'Graphic Design': [
    { key: 'designs_per_month', label: 'Designs / Month', type: 'number', placeholder: '10' },
    { key: 'design_types', label: 'Design Types', type: 'multiselect', options: ['Social Media Graphics', 'Ads / Banners', 'Brochures / Flyers', 'Logo / Branding', 'Infographics', 'Presentations', 'Email Templates'] },
    { key: 'tool', label: 'Design Tool', type: 'select', options: ['Canva', 'Adobe Illustrator', 'Figma', 'Photoshop', 'Client Preference'] },
  ],
  'Website Maintenance': [
    { key: 'hours_per_month', label: 'Hours / Month', type: 'number', placeholder: '5' },
    { key: 'includes', label: 'Includes', type: 'multiselect', options: ['Plugin Updates', 'Security Scans', 'Backups', 'Content Updates', 'Speed Optimization', 'Uptime Monitoring', 'SSL Management'] },
  ],
}

function Field({ label, required, children, hint, filled }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; filled?: boolean }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {filled && <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">Auto-filled</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

const sel = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = (raw: string) => {
    const t = raw.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
  }
  return (
    <div className="min-h-[42px] w-full rounded-lg border border-white/[0.12] bg-[rgba(255,255,255,0.06)] px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-sky-500/50">
      {value.map(t => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 text-sky-300 px-2.5 py-0.5 text-sm">
          {t}
          <button type="button" onClick={() => onChange(value.filter(x => x !== t))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
        onBlur={() => { if (input.trim()) add(input) }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
    </div>
  )
}

function MultiChip({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => value.includes(o) ? onChange(value.filter(x => x !== o)) : onChange([...value, o])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${value.includes(o)
            ? 'bg-sky-500 border-sky-500 text-white'
            : 'bg-white/[0.05] border-white/[0.12] text-slate-300 hover:border-sky-400'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

interface PlaceDetails {
  name: string; phone: string; website: string; email_suggestion: string
  street_address: string; city: string; state: string; country: string
  industry: string; categories: string[]; about: string
}

function PlacesInput({ value, onChange, onDetails }: {
  value: string
  onChange: (name: string, placeId?: string) => void
  onDetails?: (d: PlaceDetails) => void
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<{ name: string; address: string; place_id: string }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [searched, setSearched] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const wrapRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string, signal?: AbortSignal) => {
    if (q.length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`, { signal })
      if (!res.ok) { setResults([]); return }
      const data = await res.json()
      setResults(data.results || [])
      setSearched(true)
    } catch (err: any) {
      if (err.name !== 'AbortError') { setResults([]); setSearched(true) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    clearTimeout(timeoutRef.current)
    if (query.length >= 2) {
      timeoutRef.current = setTimeout(() => search(query, controller.signal), 350)
    } else {
      setResults([]); setSearched(false)
    }
    return () => { clearTimeout(timeoutRef.current); controller.abort() }
  }, [query, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectPlace = async (r: { name: string; place_id: string }) => {
    setQuery(r.name)
    onChange(r.name, r.place_id)
    setOpen(false)
    if (onDetails) {
      setFetching(true)
      try {
        const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(r.place_id)}`)
        const d = await res.json()
        if (!d.error) onDetails(d)
      } catch { /* non-fatal */ } finally { setFetching(false) }
    }
  }

  const useManualName = () => {
    onChange(query)
    setOpen(false)
    setResults([])
  }

  const showDropdown = open && (results.length > 0 || (searched && !loading && query.length >= 2))

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input className="input-glass pl-9 pr-9" value={query}
          placeholder="Search Google Business or type name…" required
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} />
        {(loading || fetching) && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />}
      </div>
      {fetching && (
        <p className="text-xs text-sky-400 mt-1.5 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Fetching business details…
        </p>
      )}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/[0.12] bg-[#0f1929] shadow-2xl overflow-hidden">
          {results.length > 0 ? (
            <>
              {results.map(r => (
                <button key={r.place_id} type="button"
                  className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors border-b border-white/[0.05] last:border-0"
                  onClick={() => selectPlace(r)}>
                  <p className="text-sm font-medium text-white">{r.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.address}</p>
                </button>
              ))}
              <div className="px-4 py-2 bg-white/[0.02] flex items-center justify-between">
                <p className="text-xs text-slate-600">Not listed?</p>
                <button type="button" onClick={useManualName}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium">
                  Add &ldquo;{query}&rdquo; manually →
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-slate-400">No Google matches found.</p>
              <button type="button" onClick={useManualName}
                className="text-sm text-sky-400 hover:text-sky-300 font-medium shrink-0 ml-3">
                Add manually →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ServicePackage {
  service: string; deliverables: Record<string, any>
  price: string; billing_term: string; setup_fee: string; contract_term: string
}

function DeliverableInput({ field, value, onChange }: { field: DeliverableField; value: any; onChange: (v: any) => void }) {
  if (field.type === 'number') return <input type="number" min="0" className="input-glass" placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
  if (field.type === 'text') return <input type="text" className="input-glass" placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} />
  if (field.type === 'select') return (
    <select className={sel} value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">Select…</option>
      {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (field.type === 'multiselect') return <MultiChip options={field.options!} value={value || []} onChange={onChange} />
  if (field.type === 'tags') return <TagInput value={value || []} onChange={onChange} placeholder="Type and press Enter…" />
  return null
}

function ServicePackageCard({ pkg, onUpdate, onRemove }: { pkg: ServicePackage; onUpdate: (p: ServicePackage) => void; onRemove: () => void }) {
  const fields = SERVICE_DELIVERABLES[pkg.service] || []
  const setDel = (key: string, val: any) => onUpdate({ ...pkg, deliverables: { ...pkg.deliverables, [key]: val } })
  return (
    <div className="border border-white/[0.12] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-sky-500/10 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="font-semibold text-white">{pkg.service}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-slate-500 hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5 space-y-5">
        {fields.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Deliverables</p>
            <div className="space-y-4">
              {fields.map(f => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <DeliverableInput field={f} value={pkg.deliverables[f.key]} onChange={v => setDel(f.key, v)} />
                </Field>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Pricing & Billing</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly Price ($)" required>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input type="number" min="0" className="input-glass pl-8" placeholder="1500"
                  value={pkg.price} onChange={e => onUpdate({ ...pkg, price: e.target.value })} required />
              </div>
            </Field>
            <Field label="Billing Term" required>
              <select className={sel} value={pkg.billing_term} onChange={e => onUpdate({ ...pkg, billing_term: e.target.value })}>
                {BILLING_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Setup Fee ($)">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input type="number" min="0" className="input-glass pl-8" placeholder="0"
                  value={pkg.setup_fee} onChange={e => onUpdate({ ...pkg, setup_fee: e.target.value })} />
              </div>
            </Field>
            <Field label="Contract Term" required>
              <select className={sel} value={pkg.contract_term} onChange={e => onUpdate({ ...pkg, contract_term: e.target.value })}>
                {CONTRACT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { label: 'Client Info', icon: Building2 },
  { label: 'Services', icon: Briefcase },
  { label: 'Goals', icon: Target },
  { label: 'Hosting', icon: ClipboardList },
  { label: 'Review', icon: ClipboardList },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done = i < current; const active = i === current
        return (
          <div key={s.label} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${active ? 'text-sky-400' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${done ? 'border-emerald-400 bg-emerald-400/10' : active ? 'border-sky-400 bg-sky-400/10' : 'border-white/[0.12] bg-white/[0.03]'}`}>
                {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </div>
              <span className="text-sm font-medium hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${i < current ? 'bg-emerald-400/40' : 'bg-white/[0.08]'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value?: string | string[] | null }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div className="flex gap-3 py-2 border-b border-white/[0.06] last:border-0">
      <span className="text-slate-500 text-sm w-40 shrink-0">{label}</span>
      <span className="text-slate-200 text-sm">{Array.isArray(value) ? value.join(', ') : value}</span>
    </div>
  )
}

interface FormData {
  // Contact person (the human, may own multiple businesses)
  contact_first_name: string; contact_last_name: string
  // Business info
  company_name: string; google_place_id: string; website: string; about_company: string
  industry: string; num_employees: string; email: string; phone: string
  street_address: string; city: string; state: string; country: string
  hashtags: string[]; categories: string[]; target_audience: string
  goals: string[]; stakeholder_expectations: string[]
  proposal_url: string; project_status: string
  sales_manager_id: string; dm_manager_id: string; marketing_manager_id: string
  // Hosting & domain
  domain_name: string; domain_registrar: string; domain_expiry: string
  hosting_provider: string; hosting_expiry: string; nameservers: string; hosting_notes: string
}

const defaultForm: FormData = {
  contact_first_name: '', contact_last_name: '',
  company_name: '', google_place_id: '', website: '', about_company: '',
  industry: '', num_employees: '', email: '', phone: '',
  street_address: '', city: '', state: '', country: 'US',
  hashtags: [], categories: [], target_audience: '',
  goals: [], stakeholder_expectations: [],
  proposal_url: '', project_status: 'in_onboarding',
  sales_manager_id: '', dm_manager_id: '', marketing_manager_id: '',
  domain_name: '', domain_registrar: '', domain_expiry: '',
  hosting_provider: '', hosting_expiry: '', nameservers: '', hosting_notes: '',
}

const defaultPkg = (service: string): ServicePackage => ({
  service, deliverables: {}, price: '', billing_term: 'Monthly', setup_fee: '', contract_term: '12 Months'
})

export default function NewClientPage() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string; name: string } | null>(null)
  const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([])
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => Array.isArray(d) && setUsers(d))
  }, [])

  const setF = (field: keyof FormData) => (val: any) => setForm(f => ({ ...f, [field]: val }))
  const setFE = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const toggleService = (svc: string) => {
    if (packages.find(p => p.service === svc)) setPackages(packages.filter(p => p.service !== svc))
    else setPackages([...packages, defaultPkg(svc)])
  }
  const updatePkg = (i: number, pkg: ServicePackage) => setPackages(packages.map((p, idx) => idx === i ? pkg : p))
  const removePkg = (i: number) => setPackages(packages.filter((_, idx) => idx !== i))

  const totalMonthly = packages.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0)
  const totalSetup = packages.reduce((sum, p) => sum + (parseFloat(p.setup_fee) || 0), 0)

  // Goals & Expectations only required when at least one marketing service is selected
  const needsGoals = packages.some(p => MARKETING_SERVICES.has(p.service))

  const canNext = () => {
    if (step === 0) return !!(form.contact_first_name && form.company_name && form.website && form.email && form.phone)
    if (step === 1) return packages.length > 0 && packages.every(p => !!p.price)
    if (step === 2) {
      if (!needsGoals) return true
      return !!(form.goals.length > 0 && form.stakeholder_expectations.length > 0 && form.target_audience)
    }
    return true
  }

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          num_employees: form.num_employees ? parseInt(form.num_employees) : null,
          sales_manager_id: form.sales_manager_id || null,
          dm_manager_id: form.dm_manager_id || null,
          marketing_manager_id: form.marketing_manager_id || null,
          services: packages.map(p => p.service),
          service_packages: packages,
          goals: needsGoals ? form.goals : [],
          stakeholder_expectations: needsGoals ? form.stakeholder_expectations : [],
          advertising_types: packages.filter(p => ['Google Ads / PPC', 'Meta Ads (Facebook & Instagram)', 'LinkedIn Ads', 'TikTok Ads'].includes(p.service)).flatMap(p => (p.deliverables.platforms || [])),
          domain_name: form.domain_name || null,
          domain_registrar: form.domain_registrar || null,
          domain_expiry: form.domain_expiry || null,
          hosting_provider: form.hosting_provider || null,
          hosting_expiry: form.hosting_expiry || null,
          nameservers: form.nameservers || null,
          hosting_notes: form.hosting_notes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuccess({ id: data.id, name: form.company_name })
        setTimeout(() => router.push(`/clients/${data.id}`), 2500)
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to save client.')
      }
    } catch { setError('Something went wrong. Please try again.') }
    finally { setSaving(false) }
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
          <h2 className="text-2xl font-bold text-white mb-2">Client Added!</h2>
          <p className="text-slate-300 font-medium mb-1">{success.name}</p>
          <p className="text-slate-400 text-sm mb-1">Approval email sent to jay@jaymehta.co</p>
          <p className="text-slate-500 text-xs mb-6">Once approved, QuickBooks customer & invoice will be created automatically.</p>
          <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Taking you to the client dashboard…
          </p>
          <button onClick={() => router.push(`/clients/${success.id}`)} className="btn-brand mt-6 px-6 py-2.5 font-medium rounded-lg">Go Now</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clients" className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add New Client</h1>
          <p className="text-sm text-slate-400">Complete all steps to onboard and set up billing</p>
        </div>
      </div>

      <StepBar current={step} />

      <form ref={formRef} onSubmit={e => e.preventDefault()}>

      {step === 0 && (
        <div className="space-y-5">
          {/* Contact Person */}
          <div className="glass-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-0.5">Contact Person</h2>
              <p className="text-sm text-slate-400">The individual who owns or manages this business. One person can have multiple businesses.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required>
                <input className="input-glass" value={form.contact_first_name} onChange={setFE('contact_first_name')}
                  placeholder="Jay" required />
              </Field>
              <Field label="Last Name" required>
                <input className="input-glass" value={form.contact_last_name} onChange={setFE('contact_last_name')}
                  placeholder="Mehta" required />
              </Field>
            </div>
          </div>

          {/* Business Info */}
          <div className="glass-card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white mb-0.5">Business Information</h2>
            <p className="text-sm text-slate-400">Search Google Business or type the company name manually</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Field label="Company / Business Name" required>
                <PlacesInput value={form.company_name}
                  onChange={(name, placeId) => setForm(f => ({ ...f, company_name: name, google_place_id: placeId || '' }))}
                  onDetails={d => {
                    const filled = new Set<string>()
                    setForm(f => {
                      const next = { ...f }
                      if (d.phone) { next.phone = d.phone; filled.add('phone') }
                      if (d.website) { next.website = d.website; filled.add('website') }
                      if (d.email_suggestion && !f.email) { next.email = d.email_suggestion; filled.add('email') }
                      if (d.street_address) { next.street_address = d.street_address; filled.add('street_address') }
                      if (d.city) { next.city = d.city; filled.add('city') }
                      if (d.state) { next.state = d.state; filled.add('state') }
                      if (d.country) { next.country = d.country; filled.add('country') }
                      if (d.industry) { next.industry = d.industry; filled.add('industry') }
                      if (d.categories?.length) { next.categories = d.categories; filled.add('categories') }
                      if (d.about) { next.about_company = d.about; filled.add('about_company') }
                      return next
                    })
                    setAutoFilled(filled)
                  }} />
              </Field>
            </div>
            <Field label="Website / Domain" required hint="Domain only: example.com" filled={autoFilled.has('website')}>
              <input className="input-glass" value={form.website} onChange={e => { setFE('website')(e); setAutoFilled(s => { const n = new Set(s); n.delete('website'); return n }) }} placeholder="example.com" required />
            </Field>
            <Field label="Industry" required filled={autoFilled.has('industry')}>
              <select className={sel} value={form.industry} onChange={e => { setFE('industry')(e); setAutoFilled(s => { const n = new Set(s); n.delete('industry'); return n }) }} required>
                <option value="">Select industry…</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="About Company" required filled={autoFilled.has('about_company')}
                hint={autoFilled.has('about_company') ? 'Auto-filled from Google — review and edit as needed' : 'Describe the business, what they sell, and who they serve'}>
                <textarea className="input-glass min-h-[90px] resize-y" value={form.about_company} onChange={e => { setFE('about_company')(e); setAutoFilled(s => { const n = new Set(s); n.delete('about_company'); return n }) }}
                  placeholder="Describe the business, what they sell, and who they serve…" required />
              </Field>
            </div>
            <Field label="Contact Email" required filled={autoFilled.has('email')}
              hint={autoFilled.has('email') ? 'Suggested from website domain — confirm with client' : undefined}>
              <input type="email" className="input-glass" value={form.email} onChange={e => { setFE('email')(e); setAutoFilled(s => { const n = new Set(s); n.delete('email'); return n }) }} placeholder="contact@client.com" required />
            </Field>
            <Field label="Phone Number" required filled={autoFilled.has('phone')}>
              <input className="input-glass" value={form.phone} onChange={e => { setFE('phone')(e); setAutoFilled(s => { const n = new Set(s); n.delete('phone'); return n }) }} placeholder="(512) 621-8822" required />
            </Field>
            <Field label="Number of Employees">
              <input type="number" min="1" className="input-glass" value={form.num_employees} onChange={setFE('num_employees')} placeholder="50" />
            </Field>
            <Field label="Project Status" required>
              <select className={sel} value={form.project_status} onChange={setFE('project_status')}>
                <option value="in_onboarding">In Onboarding</option>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="on_hold">On Hold</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Street Address" filled={autoFilled.has('street_address')}>
                <input className="input-glass" value={form.street_address} onChange={e => { setFE('street_address')(e); setAutoFilled(s => { const n = new Set(s); n.delete('street_address'); return n }) }} placeholder="123 Main Street" />
              </Field>
            </div>
            <Field label="City" filled={autoFilled.has('city')}>
              <input className="input-glass" value={form.city} onChange={e => { setFE('city')(e); setAutoFilled(s => { const n = new Set(s); n.delete('city'); return n }) }} placeholder="Austin" />
            </Field>
            <Field label="State" filled={autoFilled.has('state')}>
              <input className="input-glass" value={form.state} onChange={e => { setFE('state')(e); setAutoFilled(s => { const n = new Set(s); n.delete('state'); return n }) }} placeholder="TX" />
            </Field>
            <Field label="Country" filled={autoFilled.has('country')}>
              <select className={sel} value={form.country} onChange={e => { setFE('country')(e); setAutoFilled(s => { const n = new Set(s); n.delete('country'); return n }) }}>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="IN">India</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>

          {/* Team Assignment */}
          {users.length > 0 && (
            <div className="border-t border-white/[0.08] pt-6">
              <h3 className="text-sm font-semibold text-white mb-4">Team Assignment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Field label="Sales Manager">
                  <select className={sel} value={form.sales_manager_id} onChange={setFE('sales_manager_id')}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Development Manager">
                  <select className={sel} value={form.dm_manager_id} onChange={setFE('dm_manager_id')}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Marketing Manager">
                  <select className={sel} value={form.marketing_manager_id} onChange={setFE('marketing_manager_id')}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-0.5">Services & Packages</h2>
            <p className="text-sm text-slate-400 mb-5">Select all services. Each one expands with deliverables and pricing.</p>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map(svc => {
                const selected = !!packages.find(p => p.service === svc)
                return (
                  <button key={svc} type="button" onClick={() => toggleService(svc)}
                    className={`px-3 py-2 rounded-xl text-sm border transition-all font-medium ${selected
                      ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/20'
                      : 'bg-white/[0.05] border-white/[0.12] text-slate-300 hover:border-sky-400'}`}>
                    {selected && <span className="mr-1.5">✓</span>}{svc}
                  </button>
                )
              })}
            </div>
          </div>

          {packages.length === 0 && (
            <div className="glass-card p-8 text-center">
              <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select at least one service above to configure deliverables and pricing.</p>
            </div>
          )}

          {packages.map((pkg, i) => (
            <ServicePackageCard key={pkg.service} pkg={pkg} onUpdate={p => updatePkg(i, p)} onRemove={() => removePkg(i)} />
          ))}

          {packages.length > 0 && (
            <div className="glass-card p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{packages.length} service{packages.length > 1 ? 's' : ''} selected</p>
                {totalSetup > 0 && <p className="text-xs text-slate-500 mt-0.5">Setup fee: ${totalSetup.toLocaleString()}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Monthly Total</p>
                <p className="text-2xl font-bold text-sky-400">${totalMonthly.toLocaleString()}<span className="text-sm font-normal text-slate-500">/mo</span></p>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="glass-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-0.5">Goals & Expectations</h2>
            <p className="text-sm text-slate-400">Define what success looks like for this client</p>
          </div>

          {!needsGoals ? (
            <div className="flex items-start gap-3 p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl">
              <Target className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-sky-300">Goals not required for selected services</p>
                <p className="text-xs text-slate-400 mt-1">
                  Goals & Expectations apply to marketing campaigns (SEO, Ads, Social Media, etc.).
                  Your selected services (maintenance, design, or development) don&apos;t require campaign goals — click Next to continue.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Field label="Goals of Project" required><MultiChip options={GOALS} value={form.goals} onChange={setF('goals')} /></Field>
              <Field label="Stakeholder Expectations" required><MultiChip options={STAKEHOLDER_EXPECTATIONS} value={form.stakeholder_expectations} onChange={setF('stakeholder_expectations')} /></Field>
              <Field label="Target Audience" required hint="Who does this client's business serve?">
                <input className="input-glass" value={form.target_audience} onChange={setFE('target_audience')}
                  placeholder="e.g. Homeowners 30-55 in Austin TX needing HVAC repairs" />
              </Field>
            </>
          )}

          <Field label="Business Hashtags" hint="Press Enter after each"><TagInput value={form.hashtags} onChange={setF('hashtags')} placeholder="#localrestaurant #austin" /></Field>
          <Field label="Business Categories" hint="Press Enter after each"><TagInput value={form.categories} onChange={setF('categories')} placeholder="Italian Restaurant, Fine Dining" /></Field>
          <Field label="Proposal / Agreement Link" hint="Google Drive or DocuSign link to the signed proposal">
            <input className="input-glass" value={form.proposal_url} onChange={setFE('proposal_url')} placeholder="https://drive.google.com/file/d/…" />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-0.5">Hosting & Domain Details</h2>
            <p className="text-sm text-slate-400">Track the client&apos;s hosting, domain registrar, and renewal dates in one place</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Field label="Domain Name" hint="The primary domain — e.g. example.com">
                <input className="input-glass" value={form.domain_name} onChange={setFE('domain_name')} placeholder="example.com" />
              </Field>
            </div>
            <Field label="Domain Registrar">
              <select className={sel} value={form.domain_registrar} onChange={setFE('domain_registrar')}>
                <option value="">Select or type…</option>
                {DOMAIN_REGISTRARS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Domain Expiry Date">
              <input type="date" className="input-glass" value={form.domain_expiry} onChange={setFE('domain_expiry')} />
            </Field>
            <Field label="Hosting Provider">
              <select className={sel} value={form.hosting_provider} onChange={setFE('hosting_provider')}>
                <option value="">Select or type…</option>
                {HOSTING_PROVIDERS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="Hosting Renewal Date">
              <input type="date" className="input-glass" value={form.hosting_expiry} onChange={setFE('hosting_expiry')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Nameservers" hint="e.g. ns1.siteground.com, ns2.siteground.com">
                <input className="input-glass" value={form.nameservers} onChange={setFE('nameservers')} placeholder="ns1.provider.com, ns2.provider.com" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Hosting Notes" hint="Login URL, control panel type, any access notes">
                <textarea className="input-glass min-h-[80px] resize-y" value={form.hosting_notes} onChange={setFE('hosting_notes')}
                  placeholder="cPanel login at host.example.com/cpanel — credentials in LastPass…" />
              </Field>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Review & Confirm</h2>
            <p className="text-sm text-slate-400 mb-6">
              Submitting saves this client and sends an approval email to <span className="text-white font-medium">jay@jaymehta.co</span> with full pricing details. Once approved, QuickBooks customer & invoice are created automatically.
            </p>
            <div className="space-y-1 mb-6">
              <ReviewRow label="Contact Person" value={[form.contact_first_name, form.contact_last_name].filter(Boolean).join(' ')} />
              <ReviewRow label="Company" value={form.company_name} />
              <ReviewRow label="Website" value={form.website} />
              <ReviewRow label="Industry" value={form.industry} />
              <ReviewRow label="Email" value={form.email} />
              <ReviewRow label="Phone" value={form.phone} />
              <ReviewRow label="Address" value={[form.street_address, form.city, form.state, form.country].filter(Boolean).join(', ')} />
              <ReviewRow label="Status" value={form.project_status} />
              {needsGoals && <>
                <ReviewRow label="Target Audience" value={form.target_audience} />
                <ReviewRow label="Goals" value={form.goals} />
                <ReviewRow label="Expectations" value={form.stakeholder_expectations} />
              </>}
              {form.domain_name && <ReviewRow label="Domain" value={form.domain_name} />}
              {form.hosting_provider && <ReviewRow label="Hosting" value={form.hosting_provider} />}
              {form.domain_registrar && <ReviewRow label="Registrar" value={form.domain_registrar} />}
              {form.proposal_url && <ReviewRow label="Proposal" value={form.proposal_url} />}
            </div>
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Services & Pricing</p>
            <div className="space-y-3">
              {packages.map(p => (
                <div key={p.service} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{p.service}</p>
                    <p className="text-xs text-slate-500">{p.billing_term} · {p.contract_term}{parseFloat(p.setup_fee) > 0 ? ` · $${parseFloat(p.setup_fee).toLocaleString()} setup` : ''}</p>
                  </div>
                  <p className="text-sm font-semibold text-sky-400">${parseFloat(p.price).toLocaleString()}<span className="text-slate-500 font-normal">/mo</span></p>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 pt-3 border-t border-white/[0.12]">
              <span className="text-sm font-semibold text-white">Monthly Total</span>
              <span className="text-lg font-bold text-sky-400">${totalMonthly.toLocaleString()}/mo</span>
            </div>
            {totalSetup > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-sm text-slate-500">One-time Setup</span>
                <span className="text-sm text-slate-300">${totalSetup.toLocaleString()}</span>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 justify-between mt-8 pb-10">
        <button type="button"
          onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/clients')}
          className="flex items-center gap-2 px-5 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
          <ChevronLeft className="h-4 w-4" />{step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < 4 ? (
          <button type="button"
            onClick={() => { if (formRef.current?.reportValidity() !== false) setStep(s => s + 1) }}
            disabled={!canNext()}
            className="flex items-center gap-2 px-6 py-2.5 btn-brand rounded-xl text-sm font-medium disabled:opacity-40 transition-all">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 btn-brand rounded-xl text-sm font-medium disabled:opacity-60 transition-all">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Create Client & Send for Approval'}
          </button>
        )}
      </div>

      </form>
    </div>
  )
}
