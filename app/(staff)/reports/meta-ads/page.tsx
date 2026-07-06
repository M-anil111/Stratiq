'use client'
import { useState, useEffect } from 'react'
import { Download, TrendingUp, MousePointer, DollarSign, BarChart2, Percent, Users, RefreshCw, Loader2 } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface Client { id: string; company_name: string }
interface Report {
  meta_impressions: number | null
  meta_clicks: number | null
  meta_spend: number | null
  meta_roas: number | null
  meta_reach: number | null
  meta_ctr: number | null
  meta_conversions: number | null
  meta_revenue: number | null
  meta_period_start: string | null
}

const selectClass = "bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function fmt(val: number | null | undefined, prefix = '', suffix = '', decimals = 0) {
  if (val == null) return '—'
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
}

function exportCSV(client: Client | undefined, month: number, year: number, report: Report | null) {
  const rows = [
    ['Meta Ads Report', `${client?.company_name || ''}`, `${MONTHS[month]} ${year}`],
    [],
    ['Metric', 'Value'],
    ['Reach', report?.meta_reach ?? ''],
    ['Impressions', report?.meta_impressions ?? ''],
    ['Clicks', report?.meta_clicks ?? ''],
    ['CTR (%)', report?.meta_ctr ?? ''],
    ['Conversions', report?.meta_conversions ?? ''],
    ['Ad Spend ($)', report?.meta_spend ?? ''],
    ['ROAS', report?.meta_roas ?? ''],
    ['Revenue ($)', report?.meta_revenue ?? ''],
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meta-ads-${client?.company_name?.replace(/\s+/g, '-') || 'report'}-${year}-${String(month+1).padStart(2,'0')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function MetaAdsReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      const list = data?.clients || (Array.isArray(data) ? data : [])
      setClients(list)
    })
  }, [])

  const loadReport = (cId: string, m: number, y: number) => {
    if (!cId) { setReport(null); return }
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`
    setLoading(true)
    fetch(`/api/clients/${cId}/reports?month=${monthStr}`)
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        setReport(arr[0] || null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadReport(clientId, month, year) }, [clientId, month, year])

  const selectedClient = clients.find(c => c.id === clientId)

  const handleSync = async () => {
    if (!clientId) return
    setSyncing(true); setSyncMsg('')
    const integRes = await fetch(`/api/clients/${clientId}/integrations`)
    const integList = await integRes.json()
    const meta = Array.isArray(integList) ? integList.find((i: any) => i.platform === 'meta_ads') : null
    if (!meta?.ad_account_id) { setSyncMsg('No Meta ad account mapped for this client.'); setSyncing(false); return }
    const period_start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const period_end = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
    const res = await fetch('/api/integrations/meta-ads/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, ad_account_id: meta.ad_account_id, period_start, period_end }),
    })
    const d = await res.json()
    setSyncing(false)
    if (res.ok) { setSyncMsg('Synced!'); loadReport(clientId, month, year) }
    else setSyncMsg(d.error || 'Sync failed')
    setTimeout(() => setSyncMsg(''), 4000)
  }

  const kpis = [
    { label: 'Reach', value: fmt(report?.meta_reach), icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Impressions', value: fmt(report?.meta_impressions), icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Clicks', value: fmt(report?.meta_clicks), icon: MousePointer, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Ad Spend', value: fmt(report?.meta_spend, '$', '', 2), icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'ROAS', value: fmt(report?.meta_roas, '', 'x', 2), icon: BarChart2, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'CTR', value: report?.meta_ctr != null ? `${report.meta_ctr.toFixed(2)}%` : '—', icon: Percent, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ]

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meta Ads Report</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Monthly performance metrics from Facebook &amp; Instagram</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
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
          {clientId && (
            <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing…' : syncMsg || 'Sync Now'}
            </button>
          )}
          <button onClick={() => exportCSV(selectedClient, month, year, report)} disabled={!report}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50 whitespace-nowrap">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {!clientId && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 mb-6">
          <p className="text-sky-300 text-sm">Select a client to view their Meta Ads report</p>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-slate-600 dark:text-slate-400 text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading report…</div>}

      {clientId && !loading && (
        <>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
            Showing data for <span className="text-slate-900 dark:text-white font-medium">{selectedClient?.company_name}</span> — {MONTHS[month]} {year}
            {report?.meta_period_start && <span className="ml-2 text-slate-500">({report.meta_period_start})</span>}
          </p>

          {!report && (
            <div className="glass-card p-8 text-center text-slate-500 text-sm mb-4">
              No data for this period. Hit "Sync Now" to pull data from Meta Ads.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {kpis.map(kpi => {
              const Icon = kpi.icon
              return (
                <div key={kpi.label} className="glass-card p-4 flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{kpi.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary stats */}
          {report && (
            <div className="glass-card p-5 mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Performance Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">Revenue attributed</p>
                  <p className="text-slate-900 dark:text-white font-semibold mt-0.5">{fmt(report.meta_revenue, '$', '', 2)}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">Conversions</p>
                  <p className="text-slate-900 dark:text-white font-semibold mt-0.5">{fmt(report.meta_conversions)}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">Cost per conversion</p>
                  <p className="text-slate-900 dark:text-white font-semibold mt-0.5">
                    {report.meta_conversions && report.meta_spend
                      ? `$${(report.meta_spend / report.meta_conversions).toFixed(2)}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">Cost per click</p>
                  <p className="text-slate-900 dark:text-white font-semibold mt-0.5">
                    {report.meta_clicks && report.meta_spend
                      ? `$${(report.meta_spend / report.meta_clicks).toFixed(2)}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="glass-card">
            <div className="p-5 border-b border-slate-900/10 dark:border-white/[0.06]">
              <h2 className="font-semibold text-slate-900 dark:text-white">Ad Account Summary</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Account-level data (ad-set breakdown requires Meta Marketing API advanced access)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-900/10 dark:border-white/[0.06]">
                    {['Metric', 'Value'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.04]">
                  {report ? [
                    ['Reach', fmt(report.meta_reach)],
                    ['Impressions', fmt(report.meta_impressions)],
                    ['Clicks', fmt(report.meta_clicks)],
                    ['CTR', report.meta_ctr != null ? `${report.meta_ctr.toFixed(2)}%` : '—'],
                    ['Spend', fmt(report.meta_spend, '$', '', 2)],
                    ['Conversions', fmt(report.meta_conversions)],
                    ['Revenue', fmt(report.meta_revenue, '$', '', 2)],
                    ['ROAS', fmt(report.meta_roas, '', 'x', 2)],
                  ].map(([label, value]) => (
                    <tr key={label} className="hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400 font-medium">{label}</td>
                      <td className="px-5 py-3 text-slate-900 dark:text-white tabular-nums">{value}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2} className="px-5 py-10 text-center text-slate-500">
                        No data. Sync to load.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
