'use client'
import { useState } from 'react'
import { Download, Send, ChevronDown } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = [2026, 2025, 2024]

export default function MarketingReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [adsData, setAdsData] = useState({ impressions: '', clicks: '', conversions: '', spend: '', roas: '', notes: '' })
  const [metaData, setMetaData] = useState({ reach: '', impressions: '', clicks: '', conversions: '', spend: '', roas: '', notes: '' })

  const ctr = (clicks: string, impressions: string) => {
    const c = parseFloat(clicks), i = parseFloat(impressions)
    if (c && i) return ((c / i) * 100).toFixed(2) + '%'
    return '—'
  }

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Reports</h1>
          <p className="text-gray-500 text-sm">Monthly unified report per client</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Select client prompt */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
        <p className="text-sky-800 text-sm font-medium">Select a client to view their report</p>
        <p className="text-sky-600 text-xs mt-1">Go to Clients → Client Detail → Reports tab to view per-client reports, or select a client below</p>
      </div>

      {/* Section A: SEO Performance */}
      <div className="bg-white rounded-xl border border-gray-100 mb-4">
        <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => {}}>
          <div>
            <h2 className="font-semibold text-gray-900">Section A: SEO Performance</h2>
            <p className="text-sm text-gray-500">Auto-calculated from submission data</p>
          </div>
          <ChevronDown className="h-5 w-5 text-gray-400" />
        </button>
        <div className="px-5 pb-5 border-t border-gray-50">
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[
              { label: 'Off-Page Links', value: '—', sub: 'Live / Under Review / Deleted' },
              { label: 'Blog Posts', value: '—', sub: 'This month' },
              { label: 'OnPage URLs', value: '—', sub: 'Optimized this month' },
            ].map(stat => (
              <div key={stat.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm font-medium text-gray-700">{stat.label}</p>
                <p className="text-xs text-gray-400">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section B: Google Ads */}
      <div className="bg-white rounded-xl border border-gray-100 mb-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900">Section B: Google Ads Performance</h2>
            <p className="text-sm text-gray-500">Manual entry or auto-pulled via Google Ads API</p>
          </div>
          <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">Pull from Google Ads</button>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Impressions', field: 'impressions' },
            { label: 'Clicks', field: 'clicks' },
            { label: 'CTR', computed: ctr(adsData.clicks, adsData.impressions) },
            { label: 'Conversions', field: 'conversions' },
            { label: 'Ad Spend ($)', field: 'spend' },
            { label: 'ROAS', field: 'roas' },
          ].map(item => (
            <div key={item.label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{item.label}</label>
              {item.computed !== undefined
                ? <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">{item.computed}</div>
                : <input className={inputClass} type="number" value={(adsData as any)[item.field!]} onChange={e => setAdsData(d => ({ ...d, [item.field!]: e.target.value }))} placeholder="0" />
              }
            </div>
          ))}
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea className={`${inputClass} h-16 resize-none`} value={adsData.notes} onChange={e => setAdsData(d => ({ ...d, notes: e.target.value }))} placeholder="Campaign notes..." />
          </div>
        </div>
      </div>

      {/* Section C: Meta Ads */}
      <div className="bg-white rounded-xl border border-gray-100 mb-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900">Section C: Meta Ads Performance</h2>
            <p className="text-sm text-gray-500">Facebook & Instagram ad data</p>
          </div>
          <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">Pull from Meta Ads</button>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Reach', field: 'reach' },
            { label: 'Impressions', field: 'impressions' },
            { label: 'Clicks', field: 'clicks' },
            { label: 'CTR', computed: ctr(metaData.clicks, metaData.impressions) },
            { label: 'Conversions', field: 'conversions' },
            { label: 'Ad Spend ($)', field: 'spend' },
            { label: 'ROAS', field: 'roas' },
          ].map(item => (
            <div key={item.label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{item.label}</label>
              {item.computed !== undefined
                ? <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-700">{item.computed}</div>
                : <input className={inputClass} type="number" value={(metaData as any)[item.field!]} onChange={e => setMetaData(d => ({ ...d, [item.field!]: e.target.value }))} placeholder="0" />
              }
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg">
          <Send className="h-4 w-4" /> Send Report
        </button>
        <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>
    </div>
  )
}
