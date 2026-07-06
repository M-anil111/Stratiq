'use client'
import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, MousePointer, DollarSign, Target, Percent, Users, Send, Loader2 } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface GoogleData {
  impressions: number | null; clicks: number | null; conversions: number | null
  spend: number | null; roas: number | null; ctr: number | null; revenue: number | null
  campaigns: { name: string; impressions: number; clicks: number; conversions: number; spend: number; ctr: number }[]
}
interface MetaData {
  impressions: number | null; clicks: number | null; conversions: number | null
  spend: number | null; roas: number | null; ctr: number | null; reach: number | null; revenue: number | null
}
interface Report {
  id: string; year: number; month: number
  google: GoogleData; meta: MetaData; notes: string | null
}

function fmt(val: number | null | undefined, prefix = '', suffix = '', decimals = 0) {
  if (val == null) return '—'
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="glass-card p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="h-4 w-4" style={{ color: 'inherit' }} />
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

export default function PortalReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequest, setShowRequest] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setLoading(true)
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    fetch(`/api/portal/reports?month=${monthStr}`)
      .then(r => r.json())
      .then(data => setReport(Array.isArray(data) ? (data[0] || null) : null))
      .finally(() => setLoading(false))
  }, [month, year])

  const sendRequest = async () => {
    if (!requestMsg.trim()) return
    setSending(true)
    // Send as a portal message
    await fetch('/api/portal/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Report Request for ${MONTHS[month]} ${year}: ${requestMsg}` }),
    })
    setSending(false)
    setShowRequest(false)
    setRequestMsg('')
  }

  const hasGoogle = report && (report.google.impressions != null || report.google.clicks != null || report.google.spend != null)
  const hasMeta = report && (report.meta.impressions != null || report.meta.clicks != null || report.meta.spend != null)

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">My Reports</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowRequest(v => !v)}
            className="btn-brand flex items-center gap-2 px-3 py-2 text-sm font-medium">
            <Send className="h-4 w-4" /> Request Report
          </button>
        </div>
      </div>

      {showRequest && (
        <div className="glass-card p-5 mb-6">
          <h2 className="font-semibold text-white mb-3">Request Report for {MONTHS[month]} {year}</h2>
          <textarea
            value={requestMsg}
            onChange={e => setRequestMsg(e.target.value)}
            rows={3}
            placeholder="What data would you like to see? Any specific campaigns or metrics?"
            className="input-glass resize-none mb-3 w-full"
          />
          <div className="flex gap-2">
            <button onClick={sendRequest} disabled={sending || !requestMsg.trim()}
              className="btn-brand px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? 'Sending…' : 'Send Request'}
            </button>
            <button onClick={() => setShowRequest(false)}
              className="px-4 py-2 text-sm border border-white/[0.10] text-slate-400 hover:text-white rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading report…
        </div>
      ) : !report ? (
        <div className="glass-card p-12 text-center text-slate-400">
          <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium text-slate-300">No report available for {MONTHS[month]} {year}</p>
          <p className="text-sm mt-1">Use the Request button above to ask your account manager for a report.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Google Ads */}
          {hasGoogle && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <h2 className="font-semibold text-white">Google Ads</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                  <KpiCard label="Impressions" value={fmt(report.google.impressions)} icon={TrendingUp} color="bg-sky-500/10 text-sky-400" />
                  <KpiCard label="Clicks" value={fmt(report.google.clicks)} icon={MousePointer} color="bg-violet-500/10 text-violet-400" />
                  <KpiCard label="Ad Spend" value={fmt(report.google.spend, '$', '', 2)} icon={DollarSign} color="bg-emerald-500/10 text-emerald-400" />
                  <KpiCard label="ROAS" value={fmt(report.google.roas, '', 'x', 2)} icon={BarChart2} color="bg-amber-500/10 text-amber-400" />
                  <KpiCard label="CTR" value={report.google.ctr != null ? `${report.google.ctr.toFixed(2)}%` : '—'} icon={Percent} color="bg-pink-500/10 text-pink-400" />
                  <KpiCard label="Conversions" value={fmt(report.google.conversions)} icon={Target} color="bg-teal-500/10 text-teal-400" />
                </div>
                {report.google.campaigns && report.google.campaigns.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {['Campaign', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Spend'].map(h => (
                            <th key={h} className="text-left text-xs text-slate-500 pb-2 pr-4 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {report.google.campaigns.map((c, i) => (
                          <tr key={i}>
                            <td className="py-2 pr-4 text-slate-300 font-medium">{c.name}</td>
                            <td className="py-2 pr-4 text-slate-400 tabular-nums">{(c.impressions || 0).toLocaleString()}</td>
                            <td className="py-2 pr-4 text-slate-400 tabular-nums">{(c.clicks || 0).toLocaleString()}</td>
                            <td className="py-2 pr-4 text-slate-400 tabular-nums">{c.ctr != null ? `${c.ctr}%` : '—'}</td>
                            <td className="py-2 pr-4 text-slate-400 tabular-nums">{(c.conversions || 0).toLocaleString()}</td>
                            <td className="py-2 pr-4 text-slate-400 tabular-nums">${(c.spend || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta Ads */}
          {hasMeta && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <h2 className="font-semibold text-white">Meta Ads (Facebook &amp; Instagram)</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Reach" value={fmt(report.meta.reach)} icon={Users} color="bg-sky-500/10 text-sky-400" />
                  <KpiCard label="Impressions" value={fmt(report.meta.impressions)} icon={TrendingUp} color="bg-violet-500/10 text-violet-400" />
                  <KpiCard label="Clicks" value={fmt(report.meta.clicks)} icon={MousePointer} color="bg-emerald-500/10 text-emerald-400" />
                  <KpiCard label="Ad Spend" value={fmt(report.meta.spend, '$', '', 2)} icon={DollarSign} color="bg-amber-500/10 text-amber-400" />
                  <KpiCard label="ROAS" value={fmt(report.meta.roas, '', 'x', 2)} icon={BarChart2} color="bg-pink-500/10 text-pink-400" />
                  <KpiCard label="CTR" value={report.meta.ctr != null ? `${report.meta.ctr.toFixed(2)}%` : '—'} icon={Percent} color="bg-teal-500/10 text-teal-400" />
                </div>
              </div>
            </div>
          )}

          {!hasGoogle && !hasMeta && (
            <div className="glass-card p-8 text-center text-slate-500 text-sm">
              Report data has not been populated yet for this period.
            </div>
          )}

          {report.notes && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-white mb-2">Account Manager Notes</h2>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{report.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
