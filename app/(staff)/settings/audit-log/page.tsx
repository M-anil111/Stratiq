'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, ShieldCheck } from 'lucide-react'

function formatTs(ts: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function labelize(v: string) {
  return v.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDetail(metadata: any): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const parts = Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
  return parts.join(' · ')
}

const LIMIT = 50

type Facets = { actions: string[]; resourceTypes: string[]; users: { id: string; email: string | null }[] }

export default function AuditLogPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [facets, setFacets] = useState<Facets>({ actions: [], resourceTypes: [], users: [] })

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const buildParams = useCallback((off: number) => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (action) params.set('action', action)
    if (resourceType) params.set('resource_type', resourceType)
    if (userId) params.set('user_id', userId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return params
  }, [debouncedSearch, action, resourceType, userId, from, to])

  // Load first page whenever filters change.
  useEffect(() => {
    setLoading(true)
    setOffset(0)
    fetch(`/api/audit-log?${buildParams(0)}`)
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries || [])
        setTotal(d.total || 0)
        if (d.facets) setFacets(d.facets)
      })
      .catch(() => { setEntries([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [buildParams])

  const loadMore = () => {
    const next = offset + LIMIT
    setLoadingMore(true)
    fetch(`/api/audit-log?${buildParams(next)}`)
      .then(r => r.json())
      .then(d => {
        setEntries(prev => [...prev, ...(d.entries || [])])
        setOffset(next)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  const hasFilters = !!(search || action || resourceType || userId || from || to)
  const clearFilters = () => {
    setSearch(''); setAction(''); setResourceType(''); setUserId(''); setFrom(''); setTo('')
  }

  const selectCls = 'input-glass w-auto min-w-[130px] cursor-pointer'

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-sky-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm">Track all actions taken across your organization</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 dark:text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by action or user..."
            className="input-glass pl-9"
          />
        </div>
        <select value={action} onChange={e => setAction(e.target.value)} className={selectCls} title="Action">
          <option value="">All actions</option>
          {facets.actions.map(a => <option key={a} value={a}>{labelize(a)}</option>)}
        </select>
        <select value={resourceType} onChange={e => setResourceType(e.target.value)} className={selectCls} title="Entity type">
          <option value="">All entities</option>
          {facets.resourceTypes.map(r => <option key={r} value={r}>{labelize(r)}</option>)}
        </select>
        <select value={userId} onChange={e => setUserId(e.target.value)} className={selectCls} title="User">
          <option value="">All users</option>
          {facets.users.map(u => <option key={u.id} value={u.id}>{u.email || u.id.slice(0, 8)}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-glass w-40" title="From date" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-glass w-40" title="To date" />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-900/10 dark:border-white/[0.12] rounded-xl hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/[0.04] dark:bg-white/[0.03]">
              <tr>
                {['Timestamp', 'User', 'Action', 'Entity', 'Detail'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/10 dark:divide-white/[0.06]">
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
                    <p className="font-medium text-slate-600 dark:text-slate-400">{hasFilters ? 'No events match your filters' : 'No audit events yet'}</p>
                    <p className="text-sm text-slate-500 mt-1">{hasFilters ? 'Try adjusting or clearing the filters' : 'Actions taken by your team will appear here'}</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => {
                  const detail = formatDetail(entry.metadata)
                  return (
                    <tr key={entry.id} className="hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatTs(entry.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate">{entry.user_email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 whitespace-nowrap">{entry.action ? labelize(entry.action) : '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                        {entry.resource_type ? `${labelize(entry.resource_type)}${entry.resource_id ? ` #${String(entry.resource_id).slice(0, 8)}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[280px] truncate" title={detail}>{detail || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && entries.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-900/10 dark:border-white/[0.08] flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">Showing {entries.length} of {total} events</p>
            {entries.length < total && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-900/10 dark:border-white/[0.12] rounded-xl hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
