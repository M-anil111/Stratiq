'use client'
import { useState, useEffect } from 'react'

const ALL_METRICS = ['impressions', 'clicks', 'conversions', 'spend', 'roas', 'ctr'] as const
type Metric = typeof ALL_METRICS[number]

const METRIC_LABELS: Record<Metric, string> = {
  impressions: 'Impressions',
  clicks: 'Clicks',
  conversions: 'Conversions',
  spend: 'Spend ($)',
  roas: 'ROAS',
  ctr: 'CTR (%)',
}

function fmtVal(metric: Metric, val: number | null | undefined): string {
  if (val == null) return '—'
  if (metric === 'spend') return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (metric === 'roas') return `${Number(val).toFixed(2)}x`
  if (metric === 'ctr') return `${Number(val).toFixed(2)}%`
  return Number(val).toLocaleString()
}

function getDefaultMonths() {
  const now = new Date()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const from = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  return { from, to }
}

export default function ReportBuilderPage() {
  const defaults = getDefaultMonths()
  const [allClients, setAllClients] = useState<any[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [selectedMetrics, setSelectedMetrics] = useState<Set<Metric>>(new Set(ALL_METRICS))
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => setAllClients(d?.clients || (Array.isArray(d) ? d : [])))
  }, [])

  const filteredClients = allClients.filter(c =>
    c.company_name?.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const toggleClient = (id: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleMetric = (m: Metric) => {
    setSelectedMetrics(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })
  }

  const generateReport = async () => {
    if (selectedClients.size === 0) { setError('Select at least one client.'); return }
    if (!from || !to) { setError('Select a date range.'); return }
    if (selectedMetrics.size === 0) { setError('Select at least one metric.'); return }
    if (from > to) { setError('"From" month must be before or equal to "To" month.'); return }
    setError('')
    setLoading(true)
    setResults(null)
    const params = new URLSearchParams({
      clients: Array.from(selectedClients).join(','),
      from,
      to,
      metrics: Array.from(selectedMetrics).join(','),
    })
    const res = await fetch(`/api/reports/builder?${params}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Failed to generate report'); return }
    setResults(data)
  }

  const exportCsv = () => {
    if (!results || results.length === 0) return
    const channels = ['google_ads', 'meta_ads']
    const metrics = ALL_METRICS.filter(m => selectedMetrics.has(m))
    const headers = ['Client', ...channels.flatMap(ch => metrics.map(m => `${ch === 'google_ads' ? 'Google' : 'Meta'} ${METRIC_LABELS[m]}`))]
    const rows = results.map(row => [
      row.client_name,
      ...channels.flatMap(ch => metrics.map(m => {
        const val = row[ch]?.[m]
        return val != null ? String(val) : ''
      }))
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeMetrics = ALL_METRICS.filter(m => selectedMetrics.has(m))

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Report Builder</h1>

      <div className="space-y-6">
        {/* Step 1 */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-sky-400 mb-1">Step 1 — Select Clients</h2>
          <p className="text-xs text-slate-400 mb-3">{selectedClients.size} selected</p>
          <input
            type="text"
            placeholder="Search clients..."
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            className="input-glass mb-3"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredClients.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No clients found</p>
            ) : filteredClients.map(c => (
              <label key={c.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedClients.has(c.id)}
                  onChange={() => toggleClient(c.id)}
                  className="rounded border-white/[0.12] text-sky-500 focus:ring-sky-500 bg-white/[0.06]"
                />
                <span className="text-sm text-slate-300">{c.company_name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 2 */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-sky-400 mb-4">Step 2 — Select Date Range</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">From (YYYY-MM)</label>
              <input
                type="month"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="input-glass"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">To (YYYY-MM)</label>
              <input
                type="month"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="input-glass"
              />
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-sky-400 mb-4">Step 3 — Select Metrics</h2>
          <div className="flex flex-wrap gap-3">
            {ALL_METRICS.map(m => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMetrics.has(m)}
                  onChange={() => toggleMetric(m)}
                  className="rounded border-white/[0.12] text-sky-500 focus:ring-sky-500 bg-white/[0.06]"
                />
                <span className="text-sm text-slate-300">{METRIC_LABELS[m]}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={generateReport}
          disabled={loading}
          className="btn-brand w-full sm:w-auto px-6 py-2.5 disabled:opacity-60 text-sm font-medium"
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>

        {/* Results */}
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        )}

        {!loading && results !== null && (
          <div>
            {results.length === 0 ? (
              <div className="glass-card p-10 text-center text-slate-400">
                <p className="font-medium text-slate-300">No data found for the selected filters</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                  <p className="text-sm font-semibold text-slate-300">{results.length} client{results.length !== 1 ? 's' : ''}</p>
                  <button
                    onClick={exportCsv}
                    className="px-4 py-2.5 rounded-xl border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] transition-all text-sm flex items-center gap-2"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/[0.05] border-b border-white/[0.06]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">Client</th>
                        {activeMetrics.map(m => (
                          <th key={`g-${m}`} className="px-3 py-3 text-right text-xs font-semibold text-sky-400 whitespace-nowrap">
                            Google {METRIC_LABELS[m]}
                          </th>
                        ))}
                        {activeMetrics.map(m => (
                          <th key={`meta-${m}`} className="px-3 py-3 text-right text-xs font-semibold text-sky-400 whitespace-nowrap">
                            Meta {METRIC_LABELS[m]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => (
                        <tr key={row.client_id} className={i % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                          <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{row.client_name}</td>
                          {activeMetrics.map(m => (
                            <td key={`g-${m}`} className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">
                              {fmtVal(m, row.google_ads?.[m])}
                            </td>
                          ))}
                          {activeMetrics.map(m => (
                            <td key={`meta-${m}`} className="px-3 py-3 text-right text-slate-300 whitespace-nowrap">
                              {fmtVal(m, row.meta_ads?.[m])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
