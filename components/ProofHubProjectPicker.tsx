'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Loader2, Check, X, Plus, FolderKanban, PlugZap } from 'lucide-react'

type PHProject = { id: number; name: string; description?: string }

// Optional ProofHub linking widget for create flows. Lets the user search
// existing ProofHub projects to LINK, or create a NEW ProofHub project. Reports
// the chosen ProofHub project id via onChange. Degrades to a quiet note when
// ProofHub is not configured, and to "link only" if create isn't supported.
export default function ProofHubProjectPicker({
  value,
  onChange,
  defaultName,
}: {
  value: string | null
  onChange: (id: string | null, name?: string) => void
  defaultName?: string
}) {
  const [status, setStatus] = useState<'loading' | 'off' | 'on'>('loading')
  const [projects, setProjects] = useState<PHProject[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'link' | 'create'>('link')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/proofhub/status')
      .then((r) => r.json())
      .then((j) => setStatus(j.configured ? 'on' : 'off'))
      .catch(() => setStatus('off'))
  }, [])

  useEffect(() => {
    if (status !== 'on') return
    setLoadingList(true)
    fetch('/api/proofhub/projects')
      .then((r) => r.json())
      .then((j) => setProjects(Array.isArray(j.projects) ? j.projects : []))
      .catch(() => setProjects([]))
      .finally(() => setLoadingList(false))
  }, [status])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Keep the selected name in sync when value is set externally / from list.
  useEffect(() => {
    if (!value) { setSelectedName(null); return }
    const hit = projects.find((p) => String(p.id) === String(value))
    if (hit) setSelectedName(hit.name)
  }, [value, projects])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects
    return list.slice(0, 8)
  }, [query, projects])

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking ProofHub…
      </div>
    )
  }

  if (status === 'off') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-900/10 dark:border-white/[0.10] bg-slate-900/[0.03] dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-500">
        <PlugZap className="h-4 w-4 shrink-0" />
        ProofHub isn&apos;t connected — linking is unavailable. An admin can set the ProofHub environment variables to enable it.
      </div>
    )
  }

  // Linked state
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{selectedName || `ProofHub project #${value}`}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Linked ProofHub project</p>
          </div>
        </div>
        <button type="button" onClick={() => { onChange(null); setSelectedName(null) }} className="text-slate-500 hover:text-red-500 transition-colors shrink-0" aria-label="Unlink">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  async function createProject() {
    const title = newTitle.trim()
    if (!title) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/proofhub/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to create project')
      const p = j.project
      if (p?.id != null) {
        setProjects((prev) => [{ id: p.id, name: p.title || p.name || title }, ...prev])
        onChange(String(p.id), p.title || p.name || title)
        setSelectedName(p.title || p.name || title)
      }
      setNewTitle('')
      setMode('link')
    } catch (e: any) {
      setError(e.message || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <div className="flex items-center gap-1 rounded-lg bg-slate-900/[0.05] dark:bg-white/[0.06] p-0.5 w-fit">
        <button type="button" onClick={() => setMode('link')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'link' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
          Link existing
        </button>
        <button type="button" onClick={() => { setMode('create'); if (!newTitle && defaultName) setNewTitle(defaultName) }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${mode === 'create' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
          Create new
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {mode === 'link' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className="input-glass pl-9 pr-9 w-full"
            placeholder={loadingList ? 'Loading ProofHub projects…' : 'Search ProofHub projects…'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          {loadingList && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />}
          {open && matches.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-900/10 dark:border-white/[0.12] bg-white dark:bg-[#0f1929] shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {matches.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => { onChange(String(p.id), p.name); setSelectedName(p.name); setOpen(false); setQuery('') }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] border-b border-slate-900/10 dark:border-white/[0.05] last:border-0 transition-colors flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-sky-500 shrink-0" />
                  <span className="text-sm text-slate-900 dark:text-white truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {open && !loadingList && matches.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-900/10 dark:border-white/[0.12] bg-white dark:bg-[#0f1929] shadow-2xl px-4 py-3 text-sm text-slate-500">
              No matching ProofHub projects.
            </div>
          )}
        </div>
      )}

      {mode === 'create' && (
        <div className="flex items-center gap-2">
          <input
            className="input-glass flex-1"
            placeholder="New ProofHub project title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createProject() } }}
          />
          <button type="button" onClick={createProject} disabled={creating || !newTitle.trim()}
            className="btn-brand rounded-lg px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
          </button>
        </div>
      )}
    </div>
  )
}
