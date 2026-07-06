'use client'
import { useState, useEffect } from 'react'
import { Download, Send, ChevronDown, ChevronRight, Link2, Printer, BarChart3, ExternalLink } from 'lucide-react'
import { buildLinkingUrl, toEmbedUrl } from '@/lib/looker'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface Client { id: string; company_name: string }
interface Report {
  google_impressions: number | null
  google_clicks: number | null
  google_conversions: number | null
  google_spend: number | null
  google_roas: number | null
  google_revenue: number | null
  google_period_start: string | null
  google_period_end: string | null
  meta_reach: number | null
  meta_impressions: number | null
  meta_clicks: number | null
  meta_conversions: number | null
  meta_spend: number | null
  meta_roas: number | null
  meta_revenue: number | null
  meta_period_start: string | null
  meta_period_end: string | null
  seo_offpage_count: number | null
  seo_blog_count: number | null
  seo_onpage_count: number | null
  notes: string | null
  prev?: Record<string, any> | null
}

// Metrics where a decrease is a good thing (cost-type metrics)
const DOWN_IS_GOOD = new Set(['google_spend', 'meta_spend'])

function DeltaBadge({ field, current, prev }: { field: string; current: any; prev: any }) {
  if (current == null || prev == null || typeof current !== 'number' || typeof prev !== 'number' || prev === 0) return null
  const pct = ((current - prev) / Math.abs(prev)) * 100
  if (!isFinite(pct) || pct === 0) return null
  const up = pct > 0
  const good = DOWN_IS_GOOD.has(field) ? !up : up
  return (
    <span className={`ml-1.5 text-[10px] font-semibold ${good ? 'text-emerald-400' : 'text-red-400'}`}
      title="vs previous month">
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

const selectClass = "bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

export default function MarketingReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState('')
  const [seoOpen, setSeoOpen] = useState(true)
  const [gadsOpen, setGadsOpen] = useState(true)
  const [metaOpen, setMetaOpen] = useState(true)
  const [form, setForm] = useState<Partial<Report>>({})
  const [lookerOpen, setLookerOpen] = useState(false)
  const [lookerUrl, setLookerUrl] = useState<string | null>(null)
  const [lookerInput, setLookerInput] = useState('')
  const [lookerGaProperty, setLookerGaProperty] = useState<string | null>(null)
  const [lookerTemplateId, setLookerTemplateId] = useState<string | null>(null)
  const [lookerSaving, setLookerSaving] = useState(false)
  const [lookerError, setLookerError] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setClients(data?.clients || (Array.isArray(data) ? data : []))
    })
    // Load the org-level Looker Studio template report ID (for Linking API).
    fetch('/api/settings/integrations')
      .then(r => r.json())
      .then(d => setLookerTemplateId(d?.looker_template_report_id || null))
      .catch(() => {})
  }, [])

  // Load the selected client's Looker Studio config.
  useEffect(() => {
    if (!clientId) { setLookerUrl(null); setLookerInput(''); setLookerGaProperty(null); return }
    fetch(`/api/clients/${clientId}/looker`)
      .then(r => r.json())
      .then(d => {
        setLookerUrl(d?.looker_report_url || null)
        setLookerInput(d?.looker_report_url || '')
        setLookerGaProperty(d?.ga_property_id || null)
      })
      .catch(() => { setLookerUrl(null); setLookerInput(''); setLookerGaProperty(null) })
  }, [clientId])

  useEffect(() => {
    if (!clientId) { setReport(null); setForm({}); return }
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    setLoading(true)
    fetch(`/api/clients/${clientId}/reports?month=${monthStr}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          const r = Array.isArray(data) ? data[0] : data
          setReport(r || null)
          setForm(r || {})
        }
      })
      .finally(() => setLoading(false))
  }, [clientId, month, year])

  const STRING_FIELDS: (keyof Report)[] = ['google_period_start', 'google_period_end', 'meta_period_start', 'meta_period_end', 'notes']
  const set = (field: keyof Report) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value === '' ? null : STRING_FIELDS.includes(field) ? e.target.value : Number(e.target.value) }))

  const ctr = (clicks: number | null | undefined, impressions: number | null | undefined) => {
    if (clicks && impressions) return ((clicks / impressions) * 100).toFixed(2) + '%'
    return '—'
  }

  const handleSave = async () => {
    if (!clientId) return
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    setSaving(true)
    await fetch(`/api/clients/${clientId}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: monthStr, ...form }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSendToClient = async () => {
    if (!clientId) return
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    setSending(true)
    setSendError('')
    const res = await fetch(`/api/clients/${clientId}/reports/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: monthStr }),
    })
    setSending(false)
    if (res.ok) {
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } else {
      const err = await res.json()
      setSendError(err.error || 'Failed to send')
      setTimeout(() => setSendError(''), 4000)
    }
  }

  const handleCopyShareLink = async () => {
    if (!clientId) return
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    setSharing(true)
    setShareError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/reports/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthStr }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setShareError(data.error || 'Failed to create share link')
        setTimeout(() => setShareError(''), 4000)
        return
      }
      await navigator.clipboard.writeText(window.location.origin + data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShareError('Failed to create share link')
      setTimeout(() => setShareError(''), 4000)
    } finally {
      setSharing(false)
    }
  }

  const handleLookerSave = async () => {
    if (!clientId) return
    setLookerSaving(true)
    setLookerError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/looker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ looker_report_url: lookerInput.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setLookerUrl(d.looker_report_url || null)
      } else {
        setLookerError(d.error || 'Failed to save')
        setTimeout(() => setLookerError(''), 4000)
      }
    } catch {
      setLookerError('Failed to save')
      setTimeout(() => setLookerError(''), 4000)
    } finally {
      setLookerSaving(false)
    }
  }

  const client = clients.find(c => c.id === clientId)
  const embedUrl = toEmbedUrl(lookerUrl)
  const linkingUrl = buildLinkingUrl({
    reportId: lookerTemplateId,
    reportName: client ? `${client.company_name} — Marketing Dashboard` : 'Marketing Dashboard',
    ga4PropertyId: lookerGaProperty,
  })

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing Reports</h1>
          <p className="text-slate-400 text-sm">Monthly unified report per client</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${selectClass} min-w-[160px]`}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectClass}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectClass}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {!clientId && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 mb-6">
          <p className="text-sky-300 text-sm font-medium">Select a client to view their monthly report</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading report…</div>
      )}

      {clientId && !loading && (
        <>
          {/* Section A: SEO */}
          <div className="glass-card mb-4">
            <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setSeoOpen(o => !o)}>
              <div>
                <h2 className="font-semibold text-white">Section A: SEO Performance</h2>
                <p className="text-sm text-slate-400">Auto-calculated from submission data</p>
              </div>
              {seoOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>
            {seoOpen && (
              <div className="px-5 pb-5 border-t border-white/[0.06]">
                <div className="grid grid-cols-3 gap-4 mt-4">
                  {[
                    { label: 'Off-Page Links', value: report?.seo_offpage_count ?? '—', sub: 'This month' },
                    { label: 'Blog Posts', value: report?.seo_blog_count ?? '—', sub: 'This month' },
                    { label: 'OnPage URLs', value: report?.seo_onpage_count ?? '—', sub: 'Optimized' },
                  ].map(stat => (
                    <div key={stat.label} className="glass-card p-4 text-center">
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-sm font-medium text-slate-300">{stat.label}</p>
                      <p className="text-xs text-slate-500">{stat.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section B: Google Ads */}
          <div className="glass-card mb-4">
            <button className="w-full flex items-center justify-between p-5 border-b border-white/[0.06] text-left" onClick={() => setGadsOpen(o => !o)}>
              <div>
                <h2 className="font-semibold text-white">Section B: Google Ads Performance</h2>
                <p className="text-sm text-slate-400">Enter data or sync via Google Ads integration</p>
              </div>
              {gadsOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>
            {gadsOpen && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Impressions', field: 'google_impressions' as keyof Report, type: 'number' },
                  { label: 'Clicks', field: 'google_clicks' as keyof Report, type: 'number' },
                  { label: 'CTR', computed: ctr(form.google_clicks, form.google_impressions) },
                  { label: 'Conversions', field: 'google_conversions' as keyof Report, type: 'number' },
                  { label: 'Ad Spend ($)', field: 'google_spend' as keyof Report, type: 'number' },
                  { label: 'ROAS', field: 'google_roas' as keyof Report, type: 'number' },
                  { label: 'Revenue ($)', field: 'google_revenue' as keyof Report, type: 'number' },
                  { label: 'Period Start', field: 'google_period_start' as keyof Report, type: 'date' },
                  { label: 'Period End', field: 'google_period_end' as keyof Report, type: 'date' },
                ].map(item => (
                  <div key={item.label}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {item.label}
                      {item.field !== undefined && item.type === 'number' && report?.prev && (
                        <DeltaBadge field={item.field} current={(form as any)[item.field]} prev={(report.prev as any)[item.field]} />
                      )}
                    </label>
                    {item.computed !== undefined
                      ? <div className="px-3 py-2 bg-white/[0.05] rounded-lg text-sm font-medium text-slate-300">{item.computed}</div>
                      : <input className="input-glass" type={item.type || 'number'} value={(form as any)[item.field!] ?? ''} onChange={set(item.field!)} placeholder={item.type === 'date' ? '' : '0'} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Meta Ads */}
          <div className="glass-card mb-4">
            <button className="w-full flex items-center justify-between p-5 border-b border-white/[0.06] text-left" onClick={() => setMetaOpen(o => !o)}>
              <div>
                <h2 className="font-semibold text-white">Section C: Meta Ads Performance</h2>
                <p className="text-sm text-slate-400">Facebook &amp; Instagram ad data</p>
              </div>
              {metaOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>
            {metaOpen && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Reach', field: 'meta_reach' as keyof Report, type: 'number' },
                  { label: 'Impressions', field: 'meta_impressions' as keyof Report, type: 'number' },
                  { label: 'Clicks', field: 'meta_clicks' as keyof Report, type: 'number' },
                  { label: 'CTR', computed: ctr(form.meta_clicks, form.meta_impressions) },
                  { label: 'Conversions', field: 'meta_conversions' as keyof Report, type: 'number' },
                  { label: 'Ad Spend ($)', field: 'meta_spend' as keyof Report, type: 'number' },
                  { label: 'ROAS', field: 'meta_roas' as keyof Report, type: 'number' },
                  { label: 'Revenue ($)', field: 'meta_revenue' as keyof Report, type: 'number' },
                  { label: 'Period Start', field: 'meta_period_start' as keyof Report, type: 'date' },
                  { label: 'Period End', field: 'meta_period_end' as keyof Report, type: 'date' },
                ].map(item => (
                  <div key={item.label}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {item.label}
                      {item.field !== undefined && item.type === 'number' && report?.prev && (
                        <DeltaBadge field={item.field} current={(form as any)[item.field]} prev={(report.prev as any)[item.field]} />
                      )}
                    </label>
                    {item.computed !== undefined
                      ? <div className="px-3 py-2 bg-white/[0.05] rounded-lg text-sm font-medium text-slate-300">{item.computed}</div>
                      : <input className="input-glass" type={item.type || 'number'} value={(form as any)[item.field!] ?? ''} onChange={set(item.field!)} placeholder={item.type === 'date' ? '' : '0'} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="glass-card mb-4 p-5">
            <label className="block text-sm font-semibold text-white mb-2">Notes</label>
            <textarea
              className="input-glass w-full h-24 resize-none"
              placeholder="Add notes for this report…"
              value={(form as any).notes ?? ''}
              onChange={set('notes')}
            />
          </div>

          {/* Looker Studio Dashboard */}
          <div className="glass-card mb-4">
            <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setLookerOpen(o => !o)}>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-400" />
                <div>
                  <h2 className="font-semibold text-white">Looker Studio Dashboard</h2>
                  <p className="text-sm text-slate-400">Embed a shareable Looker Studio (Google Data Studio) report</p>
                </div>
              </div>
              {lookerOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>
            {lookerOpen && (
              <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-4">
                {/* Create from template (Linking API) */}
                {linkingUrl && lookerGaProperty && (
                  <a
                    href={linkingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-brand inline-flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" /> Create dashboard from template
                  </a>
                )}

                {/* Paste + save published report URL */}
                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    type="url"
                    className="input-glass flex-1 min-w-[240px]"
                    placeholder="https://lookerstudio.google.com/reporting/…"
                    value={lookerInput}
                    onChange={e => setLookerInput(e.target.value)}
                  />
                  <button onClick={handleLookerSave} disabled={lookerSaving}
                    className="btn-brand disabled:opacity-60">
                    {lookerSaving ? 'Saving…' : 'Save'}
                  </button>
                  {lookerError && <span className="text-red-400 text-sm">{lookerError}</span>}
                </div>

                {/* Embedded report */}
                {embedUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08]" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full"
                        frameBorder={0}
                        allowFullScreen
                        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      />
                    </div>
                    {lookerUrl && (
                      <a href={lookerUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300">
                        <ExternalLink className="h-3.5 w-3.5" /> Open in Looker Studio
                      </a>
                    )}
                  </div>
                ) : !linkingUrl ? (
                  <p className="text-sm text-slate-400">
                    No Looker Studio dashboard configured. Paste a published report URL above, or set an org-wide template report ID in{' '}
                    <a href="/settings/integrations" className="text-sky-400 hover:text-sky-300">Settings → Integrations</a>{' '}
                    to generate one from a template.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap items-center">
            <button onClick={handleSave} disabled={saving}
              className="btn-brand flex items-center gap-2 px-4 py-2.5 disabled:opacity-60 text-sm font-medium">
              <Download className="h-4 w-4" /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Report'}
            </button>
            <button onClick={handleSendToClient} disabled={sending || !clientId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium">
              <Send className="h-4 w-4" /> {sending ? 'Sending…' : sent ? 'Sent!' : 'Send to Client'}
            </button>
            <button onClick={handleCopyShareLink} disabled={sharing || !clientId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium">
              <Link2 className="h-4 w-4" /> {sharing ? 'Creating link…' : copied ? 'Copied!' : 'Copy Share Link'}
            </button>
            <button
              onClick={() => {
                const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
                window.open(`/reports/print/${clientId}?month=${monthStr}`, '_blank')
              }}
              disabled={!clientId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium">
              <Printer className="h-4 w-4" /> Download PDF
            </button>
            {sendError && <span className="text-red-400 text-sm">{sendError}</span>}
            {shareError && <span className="text-red-400 text-sm">{shareError}</span>}
          </div>
        </>
      )}
    </div>
  )
}
