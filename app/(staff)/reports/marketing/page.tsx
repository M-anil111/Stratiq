'use client'
import { useState, useEffect } from 'react'
import { Download, Send, ChevronDown, ChevronRight } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface Client { id: string; company_name: string }
interface Report {
  google_impressions: number | null
  google_clicks: number | null
  google_conversions: number | null
  google_spend: number | null
  google_roas: number | null
  meta_reach: number | null
  meta_impressions: number | null
  meta_clicks: number | null
  meta_conversions: number | null
  meta_spend: number | null
  meta_roas: number | null
  seo_offpage_count: number | null
  seo_blog_count: number | null
  seo_onpage_count: number | null
}

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
  const [seoOpen, setSeoOpen] = useState(true)
  const [gadsOpen, setGadsOpen] = useState(true)
  const [metaOpen, setMetaOpen] = useState(true)
  const [form, setForm] = useState<Partial<Report>>({})

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setClients(data)
    })
  }, [])

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

  const set = (field: keyof Report) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value === '' ? null : Number(e.target.value) }))

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

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Reports</h1>
          <p className="text-gray-500 text-sm">Monthly unified report per client</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[160px]">
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {!clientId && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
          <p className="text-sky-800 text-sm font-medium">Select a client to view their monthly report</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading report…</div>
      )}

      {clientId && !loading && (
        <>
          {/* Section A: SEO */}
          <div className="bg-white rounded-xl border border-gray-100 mb-4">
            <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setSeoOpen(o => !o)}>
              <div>
                <h2 className="font-semibold text-gray-900">Section A: SEO Performance</h2>
                <p className="text-sm text-gray-500">Auto-calculated from submission data</p>
              </div>
              {seoOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
            </button>
            {seoOpen && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <div className="grid grid-cols-3 gap-4 mt-4">
                  {[
                    { label: 'Off-Page Links', value: report?.seo_offpage_count ?? '—', sub: 'This month' },
                    { label: 'Blog Posts', value: report?.seo_blog_count ?? '—', sub: 'This month' },
                    { label: 'OnPage URLs', value: report?.seo_onpage_count ?? '—', sub: 'Optimized' },
                  ].map(stat => (
                    <div key={stat.label} className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-sm font-medium text-gray-700">{stat.label}</p>
                      <p className="text-xs text-gray-400">{stat.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section B: Google Ads */}
          <div className="bg-white rounded-xl border border-gray-100 mb-4">
            <button className="w-full flex items-center justify-between p-5 border-b border-gray-50 text-left" onClick={() => setGadsOpen(o => !o)}>
              <div>
                <h2 className="font-semibold text-gray-900">Section B: Google Ads Performance</h2>
                <p className="text-sm text-gray-500">Enter data or sync via Google Ads integration</p>
              </div>
              {gadsOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
            </button>
            {gadsOpen && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Impressions', field: 'google_impressions' as keyof Report },
                  { label: 'Clicks', field: 'google_clicks' as keyof Report },
                  { label: 'CTR', computed: ctr(form.google_clicks, form.google_impressions) },
                  { label: 'Conversions', field: 'google_conversions' as keyof Report },
                  { label: 'Ad Spend ($)', field: 'google_spend' as keyof Report },
                  { label: 'ROAS', field: 'google_roas' as keyof Report },
                ].map(item => (
                  <div key={item.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{item.label}</label>
                    {item.computed !== undefined
                      ? <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">{item.computed}</div>
                      : <input className={inputClass} type="number" value={(form as any)[item.field!] ?? ''} onChange={set(item.field!)} placeholder="0" />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Meta Ads */}
          <div className="bg-white rounded-xl border border-gray-100 mb-4">
            <button className="w-full flex items-center justify-between p-5 border-b border-gray-50 text-left" onClick={() => setMetaOpen(o => !o)}>
              <div>
                <h2 className="font-semibold text-gray-900">Section C: Meta Ads Performance</h2>
                <p className="text-sm text-gray-500">Facebook &amp; Instagram ad data</p>
              </div>
              {metaOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
            </button>
            {metaOpen && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Reach', field: 'meta_reach' as keyof Report },
                  { label: 'Impressions', field: 'meta_impressions' as keyof Report },
                  { label: 'Clicks', field: 'meta_clicks' as keyof Report },
                  { label: 'CTR', computed: ctr(form.meta_clicks, form.meta_impressions) },
                  { label: 'Conversions', field: 'meta_conversions' as keyof Report },
                  { label: 'Ad Spend ($)', field: 'meta_spend' as keyof Report },
                  { label: 'ROAS', field: 'meta_roas' as keyof Report },
                ].map(item => (
                  <div key={item.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{item.label}</label>
                    {item.computed !== undefined
                      ? <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">{item.computed}</div>
                      : <input className={inputClass} type="number" value={(form as any)[item.field!] ?? ''} onChange={set(item.field!)} placeholder="0" />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
              <Send className="h-4 w-4" /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Report'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> Export PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}
