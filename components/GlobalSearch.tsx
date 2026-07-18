'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Users, FolderKanban, FileText, Contact, Target,
  MessageSquare, Eye, Printer, ChevronDown, ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'client' | 'contact' | 'project' | 'invoice' | 'lead' | 'task'
  id: string
  title: string
  subtitle?: string
  url: string
}

// Category keys as used by the API's ?types= param
const CATEGORIES = ['clients', 'contacts', 'projects', 'invoices', 'leads', 'tasks'] as const
type Category = (typeof CATEGORIES)[number]

// result.type (singular) -> category key (plural)
const TYPE_TO_CATEGORY: Record<SearchResult['type'], Category> = {
  client: 'clients',
  contact: 'contacts',
  project: 'projects',
  invoice: 'invoices',
  lead: 'leads',
  task: 'tasks',
}

const TYPE_LABELS: Record<string, string> = {
  client: 'Clients',
  contact: 'Contacts',
  project: 'Projects',
  invoice: 'Invoices',
  lead: 'Leads',
  task: 'Tasks',
}

const CHIP_LABELS: Record<Category, string> = {
  clients: 'Clients',
  contacts: 'Contacts',
  projects: 'Projects',
  invoices: 'Invoices',
  leads: 'Leads',
  tasks: 'Tasks',
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  client: Users,
  contact: Contact,
  project: FolderKanban,
  invoice: FileText,
  lead: Target,
  task: ListChecks,
}

const GROUP_ORDER: SearchResult['type'][] = ['client', 'contact', 'project', 'invoice', 'lead', 'task']

const FILTERS_KEY = 'search_recent_filters'
const CLICKS_KEY = 'search_click_history'
const CLICK_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000 // 60 days
const CLICK_MAX_ENTRIES = 200
const DEFAULT_LIMIT = 5
const EXPANDED_LIMIT = 20

type ClickEntry = { id: string; type: string; ts: number }

function loadClickHistory(): ClickEntry[] {
  try {
    const raw = localStorage.getItem(CLICKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const cutoff = Date.now() - CLICK_MAX_AGE_MS
    return parsed.filter((e: ClickEntry) => e && typeof e.id === 'string' && typeof e.ts === 'number' && e.ts >= cutoff)
  } catch {
    return []
  }
}

function recordClick(id: string, type: string) {
  try {
    const history = loadClickHistory()
    history.push({ id, type, ts: Date.now() })
    localStorage.setItem(CLICKS_KEY, JSON.stringify(history.slice(-CLICK_MAX_ENTRIES)))
  } catch {
    // localStorage unavailable — ignore
  }
}

function loadSavedFilters(): Category[] {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((f: string): f is Category => (CATEGORIES as readonly string[]).includes(f))
  } catch {
    return []
  }
}

function saveFilters(filters: Category[]) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // ignore
  }
}

function groupResults(results: SearchResult[]) {
  const groups: Record<string, SearchResult[]> = {}
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = []
    groups[r.type].push(r)
  }
  return groups
}

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [lastLimit, setLastLimit] = useState(DEFAULT_LIMIT)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [filters, setFilters] = useState<Category[]>([])
  const [expanded, setExpanded] = useState<Set<Category>>(new Set())
  const [expandingCategory, setExpandingCategory] = useState<Category | null>(null)
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchSeq = useRef(0)

  // Load persisted filter chips + click history on mount
  useEffect(() => {
    setFilters(loadSavedFilters())
    refreshClickCounts()
  }, [])

  function refreshClickCounts() {
    const history = loadClickHistory()
    const map: Record<string, number> = {}
    for (const e of history) {
      const key = `${e.type}:${e.id}`
      map[key] = (map[key] || 0) + 1
    }
    setClickCounts(map)
  }

  const fetchResults = useCallback(async (q: string, activeFilters: Category[]) => {
    if (q.length < 2) {
      setResults([])
      setCounts({})
      setOpen(false)
      return
    }
    setLoading(true)
    const seq = ++fetchSeq.current
    try {
      const params = new URLSearchParams({ q })
      if (activeFilters.length > 0) params.set('types', activeFilters.join(','))
      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      if (seq !== fetchSeq.current) return // stale response
      setResults(data.results || [])
      setCounts(data.counts || {})
      setLastLimit(data.limit || DEFAULT_LIMIT)
      setExpanded(new Set())
      setOpen(true)
      setActiveIndex(-1)
    } catch {
      if (seq === fetchSeq.current) setResults([])
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchResults(query, filters)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filters, fetchResults])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleFilter(cat: Category | 'all') {
    setFilters(prev => {
      let next: Category[]
      if (cat === 'all') {
        next = []
      } else if (prev.includes(cat)) {
        next = prev.filter(f => f !== cat)
      } else {
        next = [...prev, cat]
      }
      saveFilters(next)
      return next
    })
    inputRef.current?.focus()
  }

  // Recency boost: items clicked before rise to the top of their category
  const rankedResults = useMemo(() => {
    const groups = groupResults(results)
    const out: SearchResult[] = []
    for (const type of GROUP_ORDER) {
      const items = groups[type]
      if (!items?.length) continue
      const scored = items.map((r, i) => ({ r, i, boost: clickCounts[`${r.type}:${r.id}`] || 0 }))
      scored.sort((a, b) => (b.boost - a.boost) || (a.i - b.i))
      out.push(...scored.map(s => s.r))
    }
    return out
  }, [results, clickCounts])

  const groups = useMemo(() => groupResults(rankedResults), [rankedResults])
  const groupOrder = GROUP_ORDER.filter(t => groups[t]?.length)

  // Flat list in render order for keyboard nav, plus section start indices
  const { flatResults, sectionStarts } = useMemo(() => {
    const flat: SearchResult[] = []
    const starts: number[] = []
    for (const type of groupOrder) {
      starts.push(flat.length)
      flat.push(...groups[type])
    }
    return { flatResults: flat, sectionStarts: starts }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, groupOrder.join(',')])

  function jumpSection(direction: 1 | -1) {
    if (sectionStarts.length === 0) return
    const current = activeIndex < 0 ? -1 : activeIndex
    if (direction === 1) {
      const next = sectionStarts.find(s => s > current)
      setActiveIndex(next !== undefined ? next : sectionStarts[0])
    } else {
      const prevStarts = sectionStarts.filter(s => s < current)
      setActiveIndex(prevStarts.length > 0 ? prevStarts[prevStarts.length - 1] : sectionStarts[sectionStarts.length - 1])
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open || flatResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.shiftKey) jumpSection(1)
      else setActiveIndex(i => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.shiftKey) jumpSection(-1)
      else setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const result = flatResults[activeIndex]
      if (result) selectResult(result)
    }
  }

  function selectResult(result: SearchResult, url?: string) {
    recordClick(result.id, result.type)
    refreshClickCounts()
    navigate(url || result.url)
  }

  function navigate(url: string) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(url)
  }

  async function seeMore(cat: Category) {
    setExpandingCategory(cat)
    try {
      const params = new URLSearchParams({ q: query, types: cat, limit: String(EXPANDED_LIMIT) })
      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      const more: SearchResult[] = data.results || []
      setResults(prev => {
        const typeKey = (Object.keys(TYPE_TO_CATEGORY) as SearchResult['type'][]).find(t => TYPE_TO_CATEGORY[t] === cat)
        const rest = prev.filter(r => r.type !== typeKey)
        return [...rest, ...more]
      })
      setCounts(prev => ({ ...prev, [cat]: (data.counts || {})[cat] ?? more.length }))
      setExpanded(prev => new Set(prev).add(cat))
    } catch {
      // keep existing results on failure
    } finally {
      setExpandingCategory(null)
    }
  }

  function quickActions(result: SearchResult): React.ReactNode {
    if (result.type === 'client') {
      return (
        <>
          <button
            title="Message"
            aria-label={`Message ${result.title}`}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); selectResult(result, `/clients/${result.id}?tab=messages`) }}
            className="p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-white/[0.08] transition-colors"
          >
            <MessageSquare style={{ width: '0.85rem', height: '0.85rem' }} />
          </button>
          <button
            title="View"
            aria-label={`View ${result.title}`}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); selectResult(result) }}
            className="p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-white/[0.08] transition-colors"
          >
            <Eye style={{ width: '0.85rem', height: '0.85rem' }} />
          </button>
        </>
      )
    }
    if (result.type === 'invoice') {
      return (
        <button
          title="Print"
          aria-label={`Print ${result.title}`}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); selectResult(result, `/invoices/${result.id}/print`) }}
          className="p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-white/[0.08] transition-colors"
        >
          <Printer style={{ width: '0.85rem', height: '0.85rem' }} />
        </button>
      )
    }
    return null
  }

  const showDropdown = open && query.length >= 2

  return (
    <div ref={containerRef} className="relative w-full lg:max-w-sm">
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 text-slate-400 pointer-events-none"
          style={{ width: '1rem', height: '1rem' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.length >= 2) setOpen(true) }}
          id="global-search-input"
          placeholder="Search… (⌘K)"
          className={cn(
            'w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-white/[0.06] border border-white/[0.08]',
            'text-slate-200 placeholder:text-slate-500',
            'focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/40',
            'transition-all duration-200'
          )}
        />
        {loading && (
          <div className="absolute right-3 w-3.5 h-3.5 border-2 border-sky-500/40 border-t-sky-400 rounded-full animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 glass-card rounded-xl overflow-hidden shadow-xl shadow-black/40 border border-white/[0.08]">
          {/* Filter chips */}
          <div className="px-2.5 pt-2.5 pb-1.5 flex flex-wrap gap-1.5 border-b border-white/[0.06]">
            <button
              onMouseDown={e => { e.preventDefault(); toggleFilter('all') }}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded-full border transition-colors',
                filters.length === 0
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200'
              )}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onMouseDown={e => { e.preventDefault(); toggleFilter(cat) }}
                className={cn(
                  'px-2 py-0.5 text-[11px] rounded-full border transition-colors',
                  filters.includes(cat)
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200'
                )}
              >
                {CHIP_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {/* Loading skeleton */}
            {loading && results.length === 0 && (
              <div className="py-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="px-3 py-2 flex flex-col gap-1.5 animate-pulse">
                    <div className="h-3 rounded bg-white/[0.08]" style={{ width: `${60 - i * 8}%` }} />
                    <div className="h-2.5 rounded bg-white/[0.05]" style={{ width: `${40 - i * 5}%` }} />
                  </div>
                ))}
              </div>
            )}

            {/* Results grouped by category */}
            {results.length > 0 && (() => {
              let itemIdx = 0
              return groupOrder.map(type => {
                const Icon = TYPE_ICONS[type]
                const cat = TYPE_TO_CATEGORY[type]
                const hasMore = !expanded.has(cat) && (counts[cat] ?? 0) >= lastLimit
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 flex items-center gap-1.5">
                      <Icon className="text-sky-400" style={{ width: '0.75rem', height: '0.75rem' }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/80">
                        {TYPE_LABELS[type]}
                      </span>
                    </div>
                    {groups[type].map(result => {
                      const idx = itemIdx++
                      const isActive = idx === activeIndex
                      const actions = quickActions(result)
                      return (
                        <div
                          key={result.id}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onMouseDown={e => { e.preventDefault(); selectResult(result) }}
                          role="option"
                          aria-selected={isActive}
                          className={cn(
                            'group w-full cursor-pointer px-3 py-2 flex items-center gap-2 transition-colors duration-100',
                            isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                          )}
                        >
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                            <span className="text-sm text-slate-200 truncate">{result.title}</span>
                            {result.subtitle && (
                              <span className="text-xs text-slate-500 truncate">{result.subtitle}</span>
                            )}
                          </div>
                          {actions && (
                            <div
                              className={cn(
                                'flex items-center gap-0.5 shrink-0 transition-opacity',
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              )}
                            >
                              {actions}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {hasMore && (
                      <button
                        onMouseDown={e => { e.preventDefault(); seeMore(cat) }}
                        disabled={expandingCategory === cat}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-xs text-sky-400/90 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                      >
                        <ChevronDown style={{ width: '0.75rem', height: '0.75rem' }} />
                        {expandingCategory === cat ? 'Loading…' : `See more ${TYPE_LABELS[type].toLowerCase()}`}
                      </button>
                    )}
                  </div>
                )
              })
            })()}

            {/* Empty state */}
            {!loading && results.length === 0 && (
              <div className="px-4 py-3">
                <p className="text-sm text-slate-500">No results for &quot;{query}&quot;</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
