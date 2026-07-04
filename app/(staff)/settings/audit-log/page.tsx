'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react'

function formatTs(ts: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

const LIMIT = 50

export default function AuditLogPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchEntries = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/audit-log?${params}`)
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setTotal(d.total || 0) })
      .catch(() => { setEntries([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [offset, debouncedSearch, from, to])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Reset offset on filter change
  useEffect(() => { setOffset(0) }, [debouncedSearch, from, to])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const currentPage = Math.floor(offset / LIMIT) + 1

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-sky-400" />
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        </div>
        <p className="text-slate-400 text-sm">Track actions taken across your organization</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by action or user..."
            className="input-glass pl-9"
          />
        </div>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="input-glass w-40"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="input-glass w-40"
          title="To date"
        />
        {(search || from || to) && (
          <button
            onClick={() => { setSearch(''); setFrom(''); setTo('') }}
            className="px-3 py-2 text-sm text-slate-400 hover:text-white border border-white/[0.12] rounded-xl hover:bg-white/[0.06] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03]">
              <tr>
                {['Timestamp', 'User', 'Action', 'Resource', 'IP Address'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 skeleton rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                    <p className="font-medium text-slate-400">No audit events yet</p>
                    <p className="text-sm text-slate-500 mt-1">Actions taken by your team will appear here</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatTs(entry.created_at)}</td>
                    <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate">{entry.user_email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 whitespace-nowrap">{entry.action || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">
                      {entry.resource_type ? `${entry.resource_type}${entry.resource_id ? ` #${entry.resource_id}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{entry.ip_address || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > LIMIT && (
          <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total} events
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                disabled={currentPage === 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-400">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setOffset(o => o + LIMIT)}
                disabled={currentPage >= totalPages}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
