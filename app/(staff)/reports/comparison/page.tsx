'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type ComparisonType = 'month-over-month' | 'client-vs-client' | 'channel' | 'team'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

interface Client { id: string; company_name: string }
interface KPI { label: string; a: string; b: string; change: number; up: boolean }

function fmtNum(n: number | null | undefined, prefix = '', suffix = '') {
  if (n == null) return '—'
  return `${prefix}${n.toLocaleString()}${suffix}`
}

function pctChange(a: number | null | undefined, b: number | null | undefined) {
  if (!a || !b) return 0
  return Math.round(((a - b) / b) * 1000) / 10
}

const selectClass = "bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

export default function ComparisonReportsPage() {
  const now = new Date()
  const [type, setType] = useState<ComparisonType>('month-over-month')
  const [clients, setClients] = useState<Client[]>([])
  const [clientA, setClientA] = useState('')
  const [clientB, setClientB] = useState('')
  const [monthA, setMonthA] = useState(now.getMonth())
  const [yearA, setYearA] = useState(now.getFullYear())
  const [monthB, setMonthB] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1)
  const [yearB, setYearB] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [reportA, setReportA] = useState<any>(null)
  const [reportB, setReportB] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setClients(data?.clients || (Array.isArray(data) ? data : []))
    })
  }, [])

  const fetchReport = async (cid: string, month: number, year: number) => {
    if (!cid) return null
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    const res = await fetch(`/api/clients/${cid}/reports?month=${monthStr}`)
    const data = await res.json()
    return Array.isArray(data) ? (data[0] || null) : data
  }

  useEffect(() => {
    if (type === 'month-over-month' && !clientA) return
    if (type === 'client-vs-client' && (!clientA || !clientB)) return
    setLoading(true)
    const cidA = clientA
    const cidB = type === 'client-vs-client' ? clientB : clientA
    const mA = monthA, yA = yearA
    const mB = type === 'client-vs-client' ? monthA : monthB
    const yB = type === 'client-vs-client' ? yearA : yearB
    Promise.all([fetchReport(cidA, mA, yA), fetchReport(cidB, mB, yB)])
      .then(([a, b]) => { setReportA(a); setReportB(b) })
      .finally(() => setLoading(false))
  }, [type, clientA, clientB, monthA, yearA, monthB, yearB])

  const kpis: KPI[] = reportA || reportB ? [
    {
      label: 'Google Impressions',
      a: fmtNum(reportA?.google_impressions),
      b: fmtNum(reportB?.google_impressions),
      change: pctChange(reportA?.google_impressions, reportB?.google_impressions),
      up: (reportA?.google_impressions || 0) >= (reportB?.google_impressions || 0),
    },
    {
      label: 'Google Clicks',
      a: fmtNum(reportA?.google_clicks),
      b: fmtNum(reportB?.google_clicks),
      change: pctChange(reportA?.google_clicks, reportB?.google_clicks),
      up: (reportA?.google_clicks || 0) >= (reportB?.google_clicks || 0),
    },
    {
      label: 'Google Spend',
      a: fmtNum(reportA?.google_spend, '$'),
      b: fmtNum(reportB?.google_spend, '$'),
      change: pctChange(reportA?.google_spend, reportB?.google_spend),
      up: false,
    },
    {
      label: 'Google ROAS',
      a: reportA?.google_roas ? `${reportA.google_roas}x` : '—',
      b: reportB?.google_roas ? `${reportB.google_roas}x` : '—',
      change: pctChange(reportA?.google_roas, reportB?.google_roas),
      up: (reportA?.google_roas || 0) >= (reportB?.google_roas || 0),
    },
    {
      label: 'Meta Impressions',
      a: fmtNum(reportA?.meta_impressions),
      b: fmtNum(reportB?.meta_impressions),
      change: pctChange(reportA?.meta_impressions, reportB?.meta_impressions),
      up: (reportA?.meta_impressions || 0) >= (reportB?.meta_impressions || 0),
    },
    {
      label: 'Meta ROAS',
      a: reportA?.meta_roas ? `${reportA.meta_roas}x` : '—',
      b: reportB?.meta_roas ? `${reportB.meta_roas}x` : '—',
      change: pctChange(reportA?.meta_roas, reportB?.meta_roas),
      up: (reportA?.meta_roas || 0) >= (reportB?.meta_roas || 0),
    },
  ] : []

  const types = [
    { value: 'month-over-month', label: 'Month over Month' },
    { value: 'client-vs-client', label: 'Client vs Client' },
  ]

  const labelA = type === 'month-over-month'
    ? `${MONTHS[monthA]} ${yearA}`
    : clients.find(c => c.id === clientA)?.company_name || 'Client A'

  const labelB = type === 'month-over-month'
    ? `${MONTHS[monthB]} ${yearB}`
    : clients.find(c => c.id === clientB)?.company_name || 'Client B'

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Comparison Reports</h1>
        <p className="text-slate-400 text-sm">Compare performance across clients or months</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {types.map(t => (
          <button key={t.value} onClick={() => setType(t.value as ComparisonType)}
            className={type === t.value
              ? 'bg-sky-500 text-white rounded-full px-4 py-2 text-sm font-medium'
              : 'bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-white rounded-full px-4 py-2 text-sm font-medium transition-colors'
            }>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 flex flex-wrap gap-3 items-end">
        {type === 'month-over-month' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client</label>
              <select value={clientA} onChange={e => setClientA(e.target.value)} className={`${selectClass} min-w-[160px]`}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Month A</label>
              <div className="flex gap-1">
                <select value={monthA} onChange={e => setMonthA(Number(e.target.value))} className={selectClass}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0,3)}</option>)}
                </select>
                <select value={yearA} onChange={e => setYearA(Number(e.target.value))} className={selectClass}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">vs Month B</label>
              <div className="flex gap-1">
                <select value={monthB} onChange={e => setMonthB(Number(e.target.value))} className={selectClass}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0,3)}</option>)}
                </select>
                <select value={yearB} onChange={e => setYearB(Number(e.target.value))} className={selectClass}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {type === 'client-vs-client' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client A</label>
              <select value={clientA} onChange={e => setClientA(e.target.value)} className={`${selectClass} min-w-[160px]`}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">vs Client B</label>
              <select value={clientB} onChange={e => setClientB(e.target.value)} className={`${selectClass} min-w-[160px]`}>
                <option value="">Select client…</option>
                {clients.filter(c => c.id !== clientA).map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Month</label>
              <div className="flex gap-1">
                <select value={monthA} onChange={e => setMonthA(Number(e.target.value))} className={selectClass}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0,3)}</option>)}
                </select>
                <select value={yearA} onChange={e => setYearA(Number(e.target.value))} className={selectClass}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400 text-sm">Loading comparison data…</div>
      )}

      {!loading && kpis.length > 0 && (
        <>
          <div className="flex gap-4 mb-4 text-sm text-slate-300">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 inline-block" />{labelA}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500 inline-block" />{labelB}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {kpis.map(kpi => (
              <div key={kpi.label} className="glass-card p-4">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">{kpi.label}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">{labelA}</p>
                    <p className="text-lg font-bold text-white">{kpi.a}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-0.5">{labelB}</p>
                    <p className="text-sm text-slate-400">{kpi.b}</p>
                  </div>
                </div>
                {kpi.change !== 0 && (
                  <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${kpi.up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {kpi.up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {kpi.change > 0 ? '+' : ''}{kpi.change}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && kpis.length === 0 && (clientA || clientB) && (
        <div className="glass-card p-6 text-center text-slate-400">
          <p className="font-medium text-slate-300">No report data found for the selected period</p>
          <p className="text-sm mt-1">Add marketing report data via the Marketing Reports page</p>
        </div>
      )}

      {!loading && !clientA && !clientB && (
        <div className="glass-card p-6 text-center text-slate-400">
          <p className="font-medium text-slate-300">Select a client to compare performance</p>
        </div>
      )}
    </div>
  )
}
