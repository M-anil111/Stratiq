'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Client {
  id: string
  company_name: string
  email?: string
}

type SectionKey = 'meta_ads' | 'google_ads' | 'seo_summary' | 'revenue_overview' | 'custom_text'

interface ReportData {
  client_id: string
  company_name?: string
  year: number
  month: number
  meta_ads_data?: {
    impressions?: number | null
    clicks?: number | null
    spend?: number | null
    roas?: number | null
    ctr?: number | null
    conversions?: number | null
    revenue?: number | null
    reach?: number | null
  } | null
  google_ads_data?: {
    impressions?: number | null
    clicks?: number | null
    spend?: number | null
    roas?: number | null
    ctr?: number | null
    conversions?: number | null
    revenue?: number | null
  } | null
  seo_offpage_count?: number | null
  seo_blog_count?: number | null
  seo_onpage_count?: number | null
  notes?: string | null
}

interface SavedTemplate {
  name: string
  sections: SectionKey[]
  customText?: string
}

const SECTION_LABELS: Record<SectionKey, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  seo_summary: 'SEO Summary',
  revenue_overview: 'Revenue Overview',
  custom_text: 'Custom Text Block',
}

const ALL_SECTIONS: SectionKey[] = ['meta_ads', 'google_ads', 'seo_summary', 'revenue_overview', 'custom_text']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(val: number | null | undefined, type: 'currency' | 'number' | 'percent' | 'x' = 'number'): string {
  if (val == null) return '—'
  if (type === 'currency') return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${Number(val).toFixed(2)}%`
  if (type === 'x') return `${Number(val).toFixed(2)}x`
  return Number(val).toLocaleString()
}

function monthLabel(yyyyMM: string): string {
  if (!yyyyMM) return ''
  const [y, m] = yyyyMM.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getDefaultMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

// ─── Preview Card ─────────────────────────────────────────────────────────────
function ReportPreview({
  data,
  sections,
  customText,
  clientName,
  month,
}: {
  data: ReportData
  sections: Set<SectionKey>
  customText: string
  clientName: string
  month: string
}) {
  const meta = data.meta_ads_data
  const google = data.google_ads_data

  return (
    <div className="glass-card p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-900/10 dark:border-white/[0.08] pb-4">
        <p className="text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">Monthly Report</p>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{clientName}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{monthLabel(month)}</p>
      </div>

      {/* Meta Ads */}
      {sections.has('meta_ads') && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Meta Ads
          </h3>
          {meta ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['Impressions', fmt(meta.impressions), 'number'],
                ['Clicks', fmt(meta.clicks), 'number'],
                ['Spend', fmt(meta.spend, 'currency'), 'currency'],
                ['ROAS', fmt(meta.roas, 'x'), 'x'],
                ['CTR', fmt(meta.ctr, 'percent'), 'percent'],
                ['Conversions', fmt(meta.conversions), 'number'],
                ['Revenue', fmt(meta.revenue, 'currency'), 'currency'],
                ['Reach', fmt(meta.reach), 'number'],
              ] as [string, string, string][]).map(([label, value]) => (
                <div key={label} className="bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No Meta Ads data for this period.</p>
          )}
        </section>
      )}

      {/* Google Ads */}
      {sections.has('google_ads') && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Google Ads
          </h3>
          {google ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['Impressions', fmt(google.impressions)],
                ['Clicks', fmt(google.clicks)],
                ['Spend', fmt(google.spend, 'currency')],
                ['ROAS', fmt(google.roas, 'x')],
                ['CTR', fmt(google.ctr, 'percent')],
                ['Conversions', fmt(google.conversions)],
                ['Revenue', fmt(google.revenue, 'currency')],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No Google Ads data for this period.</p>
          )}
        </section>
      )}

      {/* SEO Summary */}
      {sections.has('seo_summary') && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            SEO Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {([
              ['Offpage Activities', data.seo_offpage_count],
              ['Blog Posts', data.seo_blog_count],
              ['Onpage Changes', data.seo_onpage_count],
            ] as [string, number | null | undefined][]).map(([label, value]) => (
              <div key={label} className="bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmt(value)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Revenue Overview */}
      {sections.has('revenue_overview') && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            Revenue Overview
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ['Meta Revenue', fmt(meta?.revenue, 'currency')],
              ['Google Revenue', fmt(google?.revenue, 'currency')],
              ['Total Revenue', (() => {
                const m = meta?.revenue ?? 0
                const g = google?.revenue ?? 0
                if (meta?.revenue == null && google?.revenue == null) return '—'
                return fmt(m + g, 'currency')
              })()],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Custom Text Block */}
      {sections.has('custom_text') && customText && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Notes
          </h3>
          <div className="bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{customText}</p>
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportBuilderPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)

  const [selectedClientId, setSelectedClientId] = useState('')
  const [month, setMonth] = useState(getDefaultMonth())
  const [enabledSections, setEnabledSections] = useState<Set<SectionKey>>(new Set(ALL_SECTIONS))
  const [customText, setCustomText] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [sendLoading, setSendLoading] = useState(false)
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [templateName, setTemplateName] = useState('')
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [templateStatus, setTemplateStatus] = useState('')

  // Load clients
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        const list: Client[] = d?.clients || (Array.isArray(d) ? d : [])
        setClients(list)
        if (list.length > 0) setSelectedClientId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setClientsLoading(false))
  }, [])

  // Load templates from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('report_templates')
      if (raw) setSavedTemplates(JSON.parse(raw))
    } catch {}
  }, [])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  const toggleSection = (key: SectionKey) => {
    setEnabledSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const fetchReport = useCallback(async () => {
    if (!selectedClientId || !month) return
    setReportLoading(true)
    setReportError('')
    setReportData(null)
    setSendStatus(null)
    try {
      const res = await fetch(`/api/clients/${selectedClientId}/reports?month=${month}`)
      const data = await res.json()
      if (!res.ok) { setReportError(data.error || 'Failed to load report'); return }
      setReportData(data)
      setRecipientEmail(data.email || selectedClient?.email || '')
    } catch {
      setReportError('Network error loading report')
    } finally {
      setReportLoading(false)
    }
  }, [selectedClientId, month, selectedClient?.email])

  const sendReport = async () => {
    if (!selectedClientId || !month) return
    setSendLoading(true)
    setSendStatus(null)
    try {
      const body: { month: string; recipient_email?: string } = { month }
      if (recipientEmail.trim()) body.recipient_email = recipientEmail.trim()
      const res = await fetch(`/api/clients/${selectedClientId}/reports/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendStatus({ type: 'error', msg: data.error || 'Failed to send report' })
      } else {
        setSendStatus({ type: 'success', msg: 'Report sent successfully!' })
      }
    } catch {
      setSendStatus({ type: 'error', msg: 'Network error sending report' })
    } finally {
      setSendLoading(false)
    }
  }

  const saveTemplate = () => {
    if (!templateName.trim()) { setTemplateStatus('Enter a template name first.'); return }
    const tmpl: SavedTemplate = {
      name: templateName.trim(),
      sections: Array.from(enabledSections),
      customText,
    }
    const existing = savedTemplates.filter(t => t.name !== tmpl.name)
    const updated = [tmpl, ...existing]
    setSavedTemplates(updated)
    try { localStorage.setItem('report_templates', JSON.stringify(updated)) } catch {}
    setTemplateStatus(`Template "${tmpl.name}" saved.`)
    setTimeout(() => setTemplateStatus(''), 3000)
  }

  const loadTemplate = (tmpl: SavedTemplate) => {
    setEnabledSections(new Set(tmpl.sections as SectionKey[]))
    setCustomText(tmpl.customText || '')
    setTemplateStatus(`Loaded "${tmpl.name}".`)
    setTimeout(() => setTemplateStatus(''), 3000)
  }

  const deleteTemplate = (name: string) => {
    const updated = savedTemplates.filter(t => t.name !== name)
    setSavedTemplates(updated)
    try { localStorage.setItem('report_templates', JSON.stringify(updated)) } catch {}
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Report Builder</h1>

      {/* Step 1 — Client */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-sky-400 mb-4">Step 1 — Select Client</h2>
        {clientsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <select
            value={selectedClientId}
            onChange={e => { setSelectedClientId(e.target.value); setReportData(null); setReportError('') }}
            className="input-glass w-full"
          >
            {clients.length === 0 && <option value="">No clients found</option>}
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Step 2 — Month */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-sky-400 mb-4">Step 2 — Select Month</h2>
        <input
          type="month"
          value={month}
          onChange={e => { setMonth(e.target.value); setReportData(null); setReportError('') }}
          className="input-glass"
        />
      </div>

      {/* Step 3 — Sections */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-sky-400 mb-4">Step 3 — Report Sections</h2>
        <div className="space-y-3">
          {ALL_SECTIONS.map(key => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={enabledSections.has(key)}
                onChange={() => toggleSection(key)}
                className="rounded border-slate-900/10 dark:border-white/[0.12] text-sky-500 focus:ring-sky-500 bg-slate-900/[0.04] dark:bg-white/[0.06]"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {SECTION_LABELS[key]}
              </span>
            </label>
          ))}
        </div>

        {/* Custom text block input */}
        {enabledSections.has('custom_text') && (
          <div className="mt-4">
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-2">Custom Text / Notes</label>
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              rows={4}
              placeholder="Add custom notes or commentary for this report..."
              className="input-glass resize-none w-full text-sm"
            />
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-sky-400 mb-4">Templates</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="Template name..."
            className="input-glass flex-1 text-sm"
          />
          <button
            onClick={saveTemplate}
            className="px-4 py-2 rounded-xl border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm whitespace-nowrap"
          >
            Save as Template
          </button>
        </div>
        {templateStatus && (
          <p className="text-xs text-sky-400 mb-3">{templateStatus}</p>
        )}
        {savedTemplates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-2">Saved Templates</p>
            {savedTemplates.map(tmpl => (
              <div key={tmpl.name} className="flex items-center justify-between bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{tmpl.name}</p>
                  <p className="text-xs text-slate-500">{tmpl.sections.map(s => SECTION_LABELS[s as SectionKey]).join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadTemplate(tmpl)}
                    className="text-xs text-sky-400 hover:text-sky-300 px-2 py-1 rounded hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteTemplate(tmpl.name)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Button */}
      <button
        onClick={fetchReport}
        disabled={!selectedClientId || !month || reportLoading}
        className="btn-brand w-full sm:w-auto px-6 py-2.5 disabled:opacity-60 text-sm font-medium"
      >
        {reportLoading ? 'Loading...' : 'Preview Report'}
      </button>

      {/* Loading Skeleton */}
      {reportLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {reportError && (
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-sm text-red-400">{reportError}</p>
        </div>
      )}

      {/* Report Preview */}
      {!reportLoading && reportData && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Report Preview</h2>
          <ReportPreview
            data={reportData}
            sections={enabledSections}
            customText={customText}
            clientName={selectedClient?.company_name || selectedClientId}
            month={month}
          />

          {/* Send Report */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-sky-400 mb-4">Send Report</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Recipient Email (optional override)</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder={selectedClient?.email || 'client@example.com'}
                  className="input-glass w-full text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={sendReport}
                  disabled={sendLoading || !selectedClientId}
                  className="btn-brand px-6 py-2.5 disabled:opacity-60 text-sm font-medium whitespace-nowrap"
                >
                  {sendLoading ? 'Sending...' : 'Send Report'}
                </button>
              </div>
            </div>
            {sendStatus && (
              <p className={`text-sm mt-3 ${sendStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {sendStatus.msg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
