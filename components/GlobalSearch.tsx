'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, FolderKanban, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'client' | 'project' | 'invoice'
  id: string
  title: string
  subtitle?: string
  url: string
}

const TYPE_LABELS: Record<string, string> = {
  client: 'Clients',
  project: 'Projects',
  invoice: 'Invoices',
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  client: Users,
  project: FolderKanban,
  invoice: FileText,
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
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flatResults = results

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results || [])
      setOpen(true)
      setActiveIndex(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchResults(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchResults])

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open || flatResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const result = flatResults[activeIndex]
      if (result) navigate(result.url)
    }
  }

  function navigate(url: string) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(url)
  }

  const groups = groupResults(results)
  const groupOrder = ['client', 'project', 'invoice'].filter(t => groups[t]?.length)

  // Build flat index for keyboard nav
  let flatIdx = 0
  const flatIndexMap: number[] = []
  for (const type of groupOrder) {
    for (const _ of groups[type]) {
      flatIndexMap.push(flatIdx++)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
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
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search clients, projects, invoices…"
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

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 glass-card rounded-xl overflow-hidden shadow-xl shadow-black/40 border border-white/[0.08]">
          {(() => {
            let itemIdx = 0
            return groupOrder.map(type => {
              const Icon = TYPE_ICONS[type]
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
                    return (
                      <button
                        key={result.id}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={e => { e.preventDefault(); navigate(result.url) }}
                        className={cn(
                          'w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors duration-100',
                          isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                        )}
                      >
                        <span className="text-sm text-slate-200 truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-slate-500 truncate">{result.subtitle}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 glass-card rounded-xl px-4 py-3 shadow-xl shadow-black/40 border border-white/[0.08]">
          <p className="text-sm text-slate-500">No results for "{query}"</p>
        </div>
      )}
    </div>
  )
}
