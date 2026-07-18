'use client'
import { useState, useEffect } from 'react'
import { Download, TrendingUp, MousePointer, DollarSign, BarChart2, Percent, Target, RefreshCw, Loader2, Printer } from 'lucide-react'
import { ComparisonBar, BreakdownPie, colorAt } from '@/components/charts'
import { openBrandedPrint, metricTableHtml } from '../_components/printReport'
import EmptyState from '@/components/ui/EmptyState'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface Client { id: string; company_name: string }
interface Campaign { name: string; impressions: number; clicks: number; conversions: number; spend: number; ctr: number }
interface Report {
  google_impressions: number | null
  google_clicks: number | null
  google_spend: number | null
  google_roas: number | null
  google_ctr: number | null
  google_conversions: number | null
  google_revenue: number | null
  google_campaigns: Campaign[]
  google_period_start: string | null
}

const selectClass = "bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function fmt(val: number | null | undefined, prefix = '', suffix = '', decimals = 0) {
  if (val == null || val === 0 && suffix === 'x') return '—'
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
}

function exportCSV(client: Client | undefined, month: number, year: number, report: Report | null, campaigns: Campaign[]) {
  const rows = [
    ['Google Ads Report', `${client?.company_name || ''}`, `${MONTHS[month]} ${year}`],
    [],
    ['Metric', 'Value'],
    ['Impressions', report?.google_impressions ?? ''],
    ['Clicks', report?.google_clicks ?? ''],
    ['CTR (%)', report?.google_ctr ?? ''],
    ['Conversions', report?.google_conversions ?? ''],
    ['Ad Spend ($)', report?.google_spend ?? ''],
    ['ROAS', report?.google_roas ?? ''],
    [],
    ['Campaign', 'Impressions', 'Clicks', 'CTR (%)', 'Conversions', 'Spend ($)'],
    ...campaigns.map(c => [c.name, c.impressions, c.clicks, c.ctr, c.conversions, c.spend]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `google-ads-${client?.company_name?.replace(/\s+/g, '-') || 'report'}-${year}-${String(month+1).padStart(2,'0')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function GoogleAdsReportPage() {
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

  const campaigns: Campaign[] = report?.google_campaigns || []
  const selectedClient = clients.find(c => c.id === clientId)

  const downloadPdf = () => {
    openBrandedPrint({
      title: 'Google Ads Report',
      clientName: selectedClient?.company_name,
      periodLabel: `${MONTHS[month]} ${year}`,
      sections: [
        {
          heading: 'Performance',
          html: metricTableHtml([
            ['Impressions', fmt(report?.google_impressions)],
            ['Clicks', fmt(report?.google_clicks)],
            ['CTR', report?.google_ctr != null ? `${report.google_ctr.toFixed(2)}%` : '—'],
            ['Conversions', fmt(report?.google_conversions)],
            ['Ad Spend', fmt(report?.google_spend, '$', '', 2)],
            ['ROAS', fmt(report?.google_roas, '', 'x', 2)],
          ]),
        },
        ...(campaigns.length ? [{
          heading: 'Campaigns',
          html: metricTableHtml(campaigns.map(c => [c.name, `$${(c.spend || 0).toFixed(2)}`] as [string, string])),
        }] : []),
      ],
    })
  }

  const handleSync = async () => {
    if (!clientId) return
    setSyncing(true); setSyncMsg('')
    // Fetch integration for this client
    const integRes = await fetch(`/api/clients/${clientId}/integrations`)
    const integList = await integRes.json()
    const google = Array.isArray(integList) ? integList.find((i: any) => i.platform === 'google_ads') : null
    if (!google?.ad_account_id) { setSyncMsg('No Google Ads account mapped for this client.'); setSyncing(false); return }
    const period_start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const period_end = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
    const res = await fetch('/api/integrations/google-ads/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, customer_id: google.ad_account_id, period_start, period_end }),
    })
    const d = await res.json()
    setSyncing(false)
    if (res.ok) { setSyncMsg('Synced!'); loadReport(clientId, month, year) }
    else setSyncMsg(d.error || 'Sync failed')
    setTimeout(() => setSyncMsg(''), 4000)
  }

  const kpis = [
    { label: 'Impressions', value: fmt(report?.google_impressions), icon: TrendingUp, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Clicks', value: fmt(report?.google_clicks), icon: MousePointer, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Ad Spend', value: fmt(report?.google_spend, '$', '', 2), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'ROAS', value: fmt(report?.google_roas, '', 'x', 2), icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'CTR', value: report?.google_ctr != null ? `${report.google_ctr.toFixed(2)}%` : '—', icon: Percent, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'Conversions', value: fmt(report?.google_conversions), icon: Target, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ]

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Google Ads Report</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Monthly performance metrics from Google Ads</p>
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
          <button onClick={() => exportCSV(selectedClient, month, year, report, campaigns)} disabled={!report}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50 whitespace-nowrap">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={downloadPdf} disabled={!report}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50 whitespace-nowrap">
            <Printer className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>

      {!clientId && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 mb-6">
          <p className="text-sky-700 dark:text-sky-300 text-sm">Select a client to view their Google Ads report</p>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-slate-600 dark:text-slate-400 text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading report…</div>}

      {clientId && !loading && (
        <>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
            Showing data for <span className="text-slate-900 dark:text-white font-medium">{selectedClient?.company_name}</span> — {MONTHS[month]} {year}
            {report?.google_period_start && <span className="ml-2 text-slate-500">({report.google_period_start})</span>}
          </p>

          {!report && (
            <div className="glass-card mb-4">
              <EmptyState
                icon={RefreshCw}
                title="No data for this period"
                description='Hit "Sync Now" to pull data from Google Ads.'
              />
            </div>
          )}

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
                    <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{kpi.value}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{kpi.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Campaign charts */}
          {campaigns.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="glass-card p-5">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Spend by campaign</h2>
                <p className="text-xs text-slate-500 mb-4">Top campaigns by ad spend</p>
                <ComparisonBar
                  data={[...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 8)
                    .map(c => ({ name: c.name, spend: c.spend || 0 }))}
                  xKey="name"
                  layout="vertical"
                  height={280}
                  colorByCategory
                  yTickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  series={[{ key: 'spend', label: 'Spend' }]}
                />
              </div>
              <div className="glass-card p-5">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Clicks share</h2>
                <p className="text-xs text-slate-500 mb-4">Click distribution across campaigns</p>
                <BreakdownPie
                  data={campaigns.map((c, i) => ({ name: c.name, value: c.clicks || 0, color: colorAt(i) }))}
                />
              </div>
            </div>
          )}

          {/* Campaigns table */}
          <div className="glass-card">
            <div className="p-5 border-b border-slate-900/10 dark:border-white/[0.06]">
              <h2 className="font-semibold text-slate-900 dark:text-white">Campaigns</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Breakdown by campaign for this period</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-900/10 dark:border-white/[0.06]">
                    {['Campaign', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Spend'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.04]">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                        No campaign data for this period. Sync to load campaign breakdown.
                      </td>
                    </tr>
                  ) : campaigns.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-slate-900 dark:text-slate-200 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{(c.impressions || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{(c.clicks || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{c.ctr != null ? `${c.ctr}%` : '—'}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{(c.conversions || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">${(c.spend || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
