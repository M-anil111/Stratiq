'use client'
import { useState, useEffect } from 'react'
import { Download, TrendingUp, MousePointer, DollarSign, BarChart2, Percent, Target } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface Client { id: string; company_name: string }
interface Report {
  google_impressions: number | null
  google_clicks: number | null
  google_spend: number | null
  google_roas: number | null
  google_ctr: number | null
  google_conversions: number | null
}

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function fmt(val: number | null | undefined, prefix = '', suffix = '', decimals = 0) {
  if (val == null) return '—'
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
}

function ctr(clicks: number | null | undefined, impressions: number | null | undefined) {
  if (clicks && impressions) return ((clicks / impressions) * 100).toFixed(2) + '%'
  return '—'
}

export default function GoogleAdsReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setClients(data)
    })
  }, [])

  useEffect(() => {
    if (!clientId) { setReport(null); return }
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    setLoading(true)
    fetch(`/api/clients/${clientId}/reports?month=${monthStr}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          const r = Array.isArray(data) ? data[0] : data
          setReport(r || null)
        }
      })
      .finally(() => setLoading(false))
  }, [clientId, month, year])

  const kpis = [
    { label: 'Impressions', value: fmt(report?.google_impressions), icon: TrendingUp, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Clicks', value: fmt(report?.google_clicks), icon: MousePointer, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Ad Spend', value: fmt(report?.google_spend, '$', '', 2), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'ROAS', value: fmt(report?.google_roas, '', 'x', 2), icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'CTR', value: report?.google_ctr != null ? fmt(report.google_ctr, '', '%', 2) : ctr(report?.google_clicks, report?.google_impressions), icon: Percent, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'Conversions', value: fmt(report?.google_conversions), icon: Target, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ]

  const selectedClient = clients.find(c => c.id === clientId)

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Google Ads Report</h1>
          <p className="text-slate-400 text-sm mt-0.5">Monthly performance metrics from Google Ads</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${selectClass} min-w-[180px]`}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectClass}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectClass}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="px-4 py-2.5 rounded-xl border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] transition-all text-sm flex items-center gap-2 whitespace-nowrap">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {!clientId && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 mb-6">
          <p className="text-sky-300 text-sm font-medium">Select a client to view their Google Ads report</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading report…</div>
      )}

      {clientId && !loading && (
        <>
          {/* Period label */}
          <p className="text-slate-400 text-sm mb-4">
            Showing data for <span className="text-white font-medium">{selectedClient?.company_name}</span> — {MONTHS[month]} {year}
          </p>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {kpis.map(kpi => {
              const Icon = kpi.icon
              return (
                <div key={kpi.label} className="glass-card p-4 flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{kpi.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{kpi.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Campaigns table */}
          <div className="glass-card">
            <div className="p-5 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white">Campaigns</h2>
              <p className="text-sm text-slate-400 mt-0.5">Individual campaign breakdown for this period</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Campaign', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Spend', 'ROAS'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-sm">
                      No campaign data available for this period.<br />
                      <span className="text-xs">Campaign-level data will appear here once synced via the Google Ads integration.</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
