'use client'
import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type ComparisonType = 'client-vs-client' | 'month-over-month' | 'channel' | 'team'

export default function ComparisonReportsPage() {
  const [type, setType] = useState<ComparisonType>('month-over-month')

  const types = [
    { value: 'client-vs-client', label: 'Client vs Client' },
    { value: 'month-over-month', label: 'Month over Month' },
    { value: 'channel', label: 'Channel Comparison' },
    { value: 'team', label: 'Team Performance' },
  ]

  const kpis = [
    { label: 'Total Impressions', a: '142,500', b: '118,200', change: +20.6, up: true },
    { label: 'Total Clicks', a: '8,340', b: '6,920', change: +20.5, up: true },
    { label: 'Avg CTR', a: '5.85%', b: '5.85%', change: 0, up: true },
    { label: 'Total Spend', a: '$4,200', b: '$3,800', change: +10.5, up: false },
    { label: 'Conversions', a: '312', b: '248', change: +25.8, up: true },
    { label: 'ROAS', a: '3.2x', b: '2.9x', change: +10.3, up: true },
  ]

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comparison Reports</h1>
        <p className="text-gray-500 text-sm">Compare performance across clients, months, or channels</p>
      </div>

      {/* Type selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {types.map(t => (
          <button key={t.value} onClick={() => setType(t.value as ComparisonType)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${type === t.value ? 'bg-sky-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-sky-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI comparison cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">{kpi.label}</p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Current</p>
                <p className="text-lg font-bold text-gray-900">{kpi.a}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Previous</p>
                <p className="text-sm text-gray-500">{kpi.b}</p>
              </div>
            </div>
            {kpi.change !== 0 && (
              <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${kpi.up ? 'text-green-600' : 'text-red-600'}`}>
                {kpi.up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {kpi.change > 0 ? '+' : ''}{kpi.change}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Placeholder chart area */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400">
        <p className="font-medium">Connect data sources to see comparison charts</p>
        <p className="text-sm mt-1">Add clients with Google Ads or Meta Ads integrations to generate charts</p>
      </div>
    </div>
  )
}
