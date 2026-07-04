'use client'
import { useState } from 'react'
import { BarChart2, TrendingUp, X, Send } from 'lucide-react'

const MONTHS = ['January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026']

export default function PortalReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[MONTHS.length - 1])
  const [showRequest, setShowRequest] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')

  // Placeholder data for demo
  const hasData = false

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="input-glass text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setShowRequest(true)}
            className="btn-brand flex items-center gap-2 px-3 py-2 text-sm font-medium">
            <Send className="h-4 w-4" /> Request
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="glass-card p-12 text-center text-slate-400">
          <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No report available for {selectedMonth}</p>
          <p className="text-sm mt-1">Contact your account manager or click Request to ask for a report</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Google Ads Card */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <h2 className="font-semibold text-white">Google Ads</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[['Impressions', '—'], ['Clicks', '—'], ['CTR', '—'], ['Conversions', '—']].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className="text-lg font-bold text-white">{val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Request a Report</h3>
              <button onClick={() => setShowRequest(false)}><X className="h-5 w-5 text-slate-400 hover:text-white transition-colors" /></button>
            </div>
            <textarea value={requestMsg} onChange={e => setRequestMsg(e.target.value)}
              className="input-glass w-full px-3 py-2 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Describe what you'd like reported (optional)..." />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRequest(false)} className="flex-1 py-2.5 border border-white/[0.12] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">Cancel</button>
              <button className="btn-brand flex-1 py-2.5 text-sm font-medium">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
