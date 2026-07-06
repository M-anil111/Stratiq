'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  DollarSign, Eye, MousePointer, Percent, Target, Receipt, TrendingUp, BarChart2,
  Settings, Columns3, ArrowUp, ArrowDown, ArrowUpDown, X, Loader2, Plug, Info,
} from 'lucide-react'

// ---------- Types ----------

interface DerivedMetrics {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  cpc: number
  cost_per_conversion: number
  roas: number
}

interface ClientRow extends DerivedMetrics {
  client_id: string
  company_name: string
  network: 'meta' | 'google'
}

interface MonthRow {
  month: string
  spend: number
  clicks: number
  impressions: number
  revenue: number
  conversions: number
}

interface AdsReport {
  summary: DerivedMetrics
  by_network: Partial<Record<'meta' | 'google', DerivedMetrics>>
  by_client: ClientRow[]
  by_month: MonthRow[]
  roi_mode: 'revenue' | 'estimate'
}

interface Client { id: string; company_name: string }

interface RoiSettings {
  ads_roi_mode: 'revenue' | 'estimate'
  ads_avg_sale_price: number
  ads_conversion_rate: number
  is_admin: boolean
}

// ---------- Formatting helpers ----------

const selectClass = 'bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'
const inputClass = 'w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

function fmtCurrency(n: number, decimals = 2) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}
function fmtNum(n: number) {
  return n.toLocaleString()
}
function fmtMonthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

// ---------- Column config (Manage columns) ----------

const COLUMN_STORAGE_KEY = 'ads_table_columns'

type ColumnKey = 'network' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'conversions' | 'cost_per_conversion' | 'revenue' | 'roas'

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'network', label: 'Network' },
  { key: 'spend', label: 'Spend' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'cost_per_conversion', label: 'Cost / Conversion' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'roas', label: 'ROAS' },
]

function loadColumns(): Record<ColumnKey, boolean> {
  const defaults = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, true])) as Record<ColumnKey, boolean>
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    for (const c of ALL_COLUMNS) {
      if (typeof parsed[c.key] === 'boolean') defaults[c.key] = parsed[c.key]
    }
  } catch { /* corrupted storage — fall back to defaults */ }
  return defaults
}

// ---------- Network badge ----------

function NetworkBadge({ network }: { network: 'meta' | 'google' }) {
  if (network === 'meta') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25">Meta</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Google</span>
}

// ---------- Page ----------

export default function AdsAnalysisPage() {
  const [months, setMonths] = useState(6)
  const [network, setNetwork] = useState<'all' | 'meta' | 'google'>('all')
  const [clientId, setClientId] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [report, setReport] = useState<AdsReport | null>(null)
  const [loading, setLoading] = useState(true)

  const [sortKey, setSortKey] = useState<keyof ClientRow>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(() => loadColumns())
  const [showColumnsModal, setShowColumnsModal] = useState(false)

  const [roiSettings, setRoiSettings] = useState<RoiSettings | null>(null)
  const [showRoiModal, setShowRoiModal] = useState(false)
  const [roiSaving, setRoiSaving] = useState(false)
  const [roiError, setRoiError] = useState('')
  const [roiForm, setRoiForm] = useState({ mode: 'revenue' as 'revenue' | 'estimate', avgSalePrice: '0', conversionRate: '0' })

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      const list = data?.clients || (Array.isArray(data) ? data : [])
      setClients(list)
    }).catch(() => {})
    fetch('/api/reports/ads/settings').then(r => r.json()).then((data: RoiSettings) => {
      if (data && !('error' in data)) {
        setRoiSettings(data)
        setRoiForm({
          mode: data.ads_roi_mode || 'revenue',
          avgSalePrice: String(data.ads_avg_sale_price ?? 0),
          conversionRate: String(data.ads_conversion_rate ?? 0),
        })
      }
    }).catch(() => {})
  }, [])

  const loadReport = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ months: String(months), network })
    if (clientId) params.set('client_id', clientId)
    fetch(`/api/reports/ads?${params}`)
      .then(r => r.json())
      .then(data => setReport(data?.summary ? data : null))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [months, network, clientId])

  useEffect(() => { loadReport() }, [loadReport])

  const toggleColumn = (key: ColumnKey) => {
    setColumns(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const handleSort = (key: keyof ClientRow) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedRows = useMemo(() => {
    const rows = [...(report?.by_client || [])]
    rows.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (typeof av === 'string' || typeof bv === 'string') cmp = String(av).localeCompare(String(bv))
      else cmp = Number(av) - Number(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [report, sortKey, sortDir])

  // High / low cost-per-conversion callouts (only rows that actually converted)
  const cpcCallouts = useMemo(() => {
    const converted = (report?.by_client || []).filter(r => r.conversions > 0 && r.cost_per_conversion > 0)
    if (converted.length === 0) return null
    const sorted = [...converted].sort((a, b) => a.cost_per_conversion - b.cost_per_conversion)
    return { lowest: sorted[0], highest: sorted[sorted.length - 1] }
  }, [report])

  const isEstimate = report?.roi_mode === 'estimate'
  const summary = report?.summary
  const hasData = !!summary && (summary.impressions > 0 || summary.clicks > 0 || summary.spend > 0 || (report?.by_client.length ?? 0) > 0)

  const tiles = summary ? [
    { label: 'Spend', value: fmtCurrency(summary.spend), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Impressions', value: fmtNum(summary.impressions), icon: Eye, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Clicks', value: fmtNum(summary.clicks), icon: MousePointer, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'CTR', value: `${summary.ctr.toFixed(2)}%`, icon: Percent, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'Conversions', value: fmtNum(summary.conversions), icon: Target, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Cost / Conversion', value: summary.conversions > 0 ? fmtCurrency(summary.cost_per_conversion) : '—', icon: Receipt, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: isEstimate ? 'Est. Revenue' : 'Revenue', value: fmtCurrency(summary.revenue), icon: TrendingUp, color: 'text-lime-400', bg: 'bg-lime-500/10' },
    { label: isEstimate ? 'ROI (est.)' : 'ROAS', value: summary.spend > 0 ? `${summary.roas.toFixed(2)}x` : '—', icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ] : []

  const maxChartValue = Math.max(1, ...(report?.by_month || []).map(m => Math.max(m.spend, m.revenue)))

  const saveRoiSettings = async () => {
    setRoiSaving(true)
    setRoiError('')
    const payload: Record<string, any> = { ads_roi_mode: roiForm.mode }
    if (roiForm.mode === 'estimate') {
      payload.ads_avg_sale_price = Number(roiForm.avgSalePrice) || 0
      payload.ads_conversion_rate = Number(roiForm.conversionRate) || 0
    }
    const res = await fetch('/api/reports/ads/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setRoiSaving(false)
    if (!res.ok) {
      setRoiError(data?.error || 'Failed to save settings')
      return
    }
    setRoiSettings(prev => prev ? {
      ...prev,
      ads_roi_mode: roiForm.mode,
      ads_avg_sale_price: Number(roiForm.avgSalePrice) || 0,
      ads_conversion_rate: Number(roiForm.conversionRate) || 0,
    } : prev)
    setShowRoiModal(false)
    loadReport()
  }

  const SortIcon = ({ col }: { col: keyof ClientRow }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ads Analysis</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Meta &amp; Google ads performance across all clients</p>
        </div>
        <button
          onClick={() => setShowRoiModal(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all"
          title="ROI settings"
        >
          <Settings className="h-4 w-4" /> ROI Settings
        </button>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-3">
        <select value={network} onChange={e => setNetwork(e.target.value as any)} className={selectClass} aria-label="Network">
          <option value="all">All networks</option>
          <option value="meta">Meta</option>
          <option value="google">Google</option>
        </select>
        <select value={months} onChange={e => setMonths(Number(e.target.value))} className={selectClass} aria-label="Date range">
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
        <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${selectClass} min-w-[180px]`} aria-label="Client">
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 ml-auto" title="Additional attribution models coming soon">
          <span className="text-xs text-slate-500">Attribution:</span>
          <select disabled className={`${selectClass} opacity-60 cursor-not-allowed`} aria-label="Attribution model">
            <option>Last interaction</option>
          </select>
          <Info className="h-3.5 w-3.5 text-slate-500" />
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-slate-900/[0.06] dark:bg-white/[0.06] mb-3" />
                <div className="h-5 w-16 bg-slate-900/[0.08] dark:bg-white/[0.08] rounded mb-2" />
                <div className="h-3 w-20 bg-slate-900/[0.05] dark:bg-white/[0.05] rounded" />
              </div>
            ))}
          </div>
          <div className="glass-card p-6 mb-6 animate-pulse">
            <div className="h-4 w-40 bg-slate-900/[0.08] dark:bg-white/[0.08] rounded mb-6" />
            <div className="h-48 bg-slate-900/[0.04] dark:bg-white/[0.04] rounded" />
          </div>
          <div className="glass-card p-6 animate-pulse">
            <div className="h-4 w-48 bg-slate-900/[0.08] dark:bg-white/[0.08] rounded mb-4" />
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-slate-900/[0.04] dark:bg-white/[0.04] rounded mb-2" />)}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="glass-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
            <Plug className="h-7 w-7 text-sky-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No ads data yet</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            Connect your Meta and Google Ads accounts and map ad accounts to clients so Stratiq can sync
            performance data automatically. Once synced, this dashboard aggregates spend, clicks,
            conversions and ROI across every client.
          </p>
          <Link href="/settings/integrations" className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-xl transition-colors">
            Go to Settings → Integrations
          </Link>
        </div>
      )}

      {!loading && hasData && report && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
            {tiles.map(tile => {
              const Icon = tile.icon
              return (
                <div key={tile.label} className="glass-card p-4 flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-lg ${tile.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${tile.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white truncate" title={tile.value}>{tile.value}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{tile.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Spend over time chart */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Spend over time</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Monthly ad spend with {isEstimate ? 'estimated revenue' : 'revenue'} overlay</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Spend</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> {isEstimate ? 'Est. Revenue' : 'Revenue'}</span>
              </div>
            </div>
            <div className="flex items-end gap-2 sm:gap-4 h-48 overflow-x-auto pb-1">
              {report.by_month.map(m => (
                <div key={m.month} className="flex-1 min-w-[48px] flex flex-col items-center gap-2 h-full">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <div
                      className="w-1/3 max-w-[26px] bg-sky-500 rounded-t hover:bg-sky-400 transition-colors"
                      style={{ height: `${Math.max(m.spend > 0 ? 3 : 0, (m.spend / maxChartValue) * 100)}%` }}
                      title={`${fmtMonthLabel(m.month)} — Spend: ${fmtCurrency(m.spend)}`}
                    />
                    <div
                      className="w-1/3 max-w-[26px] bg-emerald-500/70 rounded-t hover:bg-emerald-400/80 transition-colors"
                      style={{ height: `${Math.max(m.revenue > 0 ? 3 : 0, (m.revenue / maxChartValue) * 100)}%` }}
                      title={`${fmtMonthLabel(m.month)} — ${isEstimate ? 'Est. revenue' : 'Revenue'}: ${fmtCurrency(m.revenue)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{fmtMonthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* High / low cost per conversion callouts */}
          {cpcCallouts && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="glass-card p-5 border-l-2 border-l-rose-500/60">
                <p className="text-xs font-medium text-rose-400 uppercase tracking-wide mb-2">Highest cost per conversion</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-900 dark:text-white font-semibold truncate">{cpcCallouts.highest.company_name}</span>
                    <NetworkBadge network={cpcCallouts.highest.network} />
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap">{fmtCurrency(cpcCallouts.highest.cost_per_conversion)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{fmtNum(cpcCallouts.highest.conversions)} conversions on {fmtCurrency(cpcCallouts.highest.spend)} spend</p>
              </div>
              <div className="glass-card p-5 border-l-2 border-l-emerald-500/60">
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">Lowest cost per conversion</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-900 dark:text-white font-semibold truncate">{cpcCallouts.lowest.company_name}</span>
                    <NetworkBadge network={cpcCallouts.lowest.network} />
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap">{fmtCurrency(cpcCallouts.lowest.cost_per_conversion)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{fmtNum(cpcCallouts.lowest.conversions)} conversions on {fmtCurrency(cpcCallouts.lowest.spend)} spend</p>
              </div>
            </div>
          )}

          {/* Client x network table */}
          <div className="glass-card">
            <div className="p-5 border-b border-slate-900/10 dark:border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Performance by client</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">One row per client and network for the selected period</p>
              </div>
              <button
                onClick={() => setShowColumnsModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all"
              >
                <Columns3 className="h-4 w-4" /> Manage columns
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-900/10 dark:border-white/[0.06]">
                    <th className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 px-5 py-3">
                      <button onClick={() => handleSort('company_name')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                        Client <SortIcon col="company_name" />
                      </button>
                    </th>
                    {ALL_COLUMNS.filter(c => columns[c.key]).map(c => (
                      <th key={c.key} className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 px-5 py-3 whitespace-nowrap">
                        <button onClick={() => handleSort(c.key)} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                          {c.key === 'revenue' && isEstimate ? 'Est. Revenue' : c.label} <SortIcon col={c.key} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.04]">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={1 + ALL_COLUMNS.filter(c => columns[c.key]).length} className="px-5 py-10 text-center text-slate-500 text-sm">
                        No client-level data for this selection.
                      </td>
                    </tr>
                  ) : sortedRows.map(row => (
                    <tr key={`${row.client_id}-${row.network}`} className="hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-slate-900 dark:text-slate-200 font-medium whitespace-nowrap">{row.company_name}</td>
                      {columns.network && <td className="px-5 py-3"><NetworkBadge network={row.network} /></td>}
                      {columns.spend && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{fmtCurrency(row.spend)}</td>}
                      {columns.impressions && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{fmtNum(row.impressions)}</td>}
                      {columns.clicks && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{fmtNum(row.clicks)}</td>}
                      {columns.ctr && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{row.ctr.toFixed(2)}%</td>}
                      {columns.conversions && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{fmtNum(row.conversions)}</td>}
                      {columns.cost_per_conversion && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{row.conversions > 0 ? fmtCurrency(row.cost_per_conversion) : '—'}</td>}
                      {columns.revenue && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{fmtCurrency(row.revenue)}</td>}
                      {columns.roas && <td className="px-5 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{row.spend > 0 ? `${row.roas.toFixed(2)}x` : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Manage columns modal */}
      {showColumnsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowColumnsModal(false)}>
          <div className="glass-card w-full max-w-sm p-6 bg-white dark:bg-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Manage columns</h3>
              <button onClick={() => setShowColumnsModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Choose which columns appear in the table. Your selection is saved on this device.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {ALL_COLUMNS.map(c => (
                <label key={c.key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={columns[c.key]}
                    onChange={() => toggleColumn(c.key)}
                    className="rounded border-slate-900/20 dark:border-white/20 bg-slate-900/[0.04] dark:bg-white/[0.06] text-sky-500 focus:ring-sky-500/50"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{c.label}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setShowColumnsModal(false)} className="mt-5 w-full px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-xl transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      {/* ROI settings modal */}
      {showRoiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRoiModal(false)}>
          <div className="glass-card w-full max-w-md p-6 bg-white dark:bg-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">ROI Settings</h3>
              <button onClick={() => setShowRoiModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Choose how revenue and ROI are calculated for ads reporting across your organization.
            </p>
            <div className="space-y-3 mb-5">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-900/10 dark:border-white/[0.08] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="roi_mode"
                  checked={roiForm.mode === 'revenue'}
                  onChange={() => setRoiForm(f => ({ ...f, mode: 'revenue' }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Revenue from synced data</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Use the conversion values reported by Meta and Google Ads.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-900/10 dark:border-white/[0.08] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="roi_mode"
                  checked={roiForm.mode === 'estimate'}
                  onChange={() => setRoiForm(f => ({ ...f, mode: 'estimate' }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Estimate</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Estimate revenue as conversions × close rate × average sale price.</span>
                </span>
              </label>
            </div>
            {roiForm.mode === 'estimate' && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1.5">Average sale price ($)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={roiForm.avgSalePrice}
                    onChange={e => setRoiForm(f => ({ ...f, avgSalePrice: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1.5">Close rate (0–1)</label>
                  <input
                    type="number" min="0" max="1" step="0.01"
                    value={roiForm.conversionRate}
                    onChange={e => setRoiForm(f => ({ ...f, conversionRate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
            {roiSettings && !roiSettings.is_admin && (
              <p className="text-xs text-amber-400/80 mb-4">Only organization admins can change ROI settings.</p>
            )}
            {roiError && <p className="text-xs text-rose-400 mb-4">{roiError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowRoiModal(false)} className="flex-1 px-4 py-2.5 border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] text-sm rounded-xl transition-all">
                Cancel
              </button>
              <button
                onClick={saveRoiSettings}
                disabled={roiSaving || (roiSettings ? !roiSettings.is_admin : false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {roiSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
