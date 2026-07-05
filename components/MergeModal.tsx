'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2, GitMerge, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'

// HubSpot-style record merge dialog (clients / contacts).
// Step 1: pick the secondary record. Step 2: side-by-side property comparison
// (primary pre-selected per HubSpot default) → confirm → merge.
// Merging is NOT reversible.

type ObjectType = 'client' | 'contact'

type MergeModalProps = {
  objectType: ObjectType
  primary: { id: string; [key: string]: any }
  onClose: () => void
  onMerged: (primaryId: string) => void
}

type PropDef = { key: string; label: string }

const CLIENT_PROPS: PropDef[] = [
  { key: 'company_name', label: 'Company name' },
  { key: 'display_name', label: 'Display name' },
  { key: 'website', label: 'Website' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'industry', label: 'Industry' },
  { key: 'about_company', label: 'About' },
  { key: 'contact_first_name', label: 'Contact first name' },
  { key: 'contact_last_name', label: 'Contact last name' },
  { key: 'street_address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'project_status', label: 'Status' },
  { key: 'target_audience', label: 'Target audience' },
  { key: 'num_employees', label: 'Employees' },
  { key: 'domain_name', label: 'Domain name' },
  { key: 'hosting_provider', label: 'Hosting provider' },
  { key: 'hosting_notes', label: 'Hosting notes' },
  { key: 'ndisk_link', label: 'NDisk link' },
  { key: 'google_drive_folder_url', label: 'Drive folder' },
  { key: 'services', label: 'Services' },
  { key: 'service_packages', label: 'Service packages' },
]

const CONTACT_PROPS: PropDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
]

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

function formatValue(v: unknown): string {
  if (isEmpty(v)) return ''
  if (Array.isArray(v)) {
    return v.map(item => (typeof item === 'object' && item !== null ? (item as any).name || (item as any).label || JSON.stringify(item) : String(item))).join(', ')
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function recordLabel(objectType: ObjectType, rec: Record<string, any> | null): string {
  if (!rec) return ''
  if (objectType === 'client') return rec.display_name || rec.company_name || rec.id
  return rec.name || rec.email || rec.id
}

export default function MergeModal({ objectType, primary, onClose, onMerged }: MergeModalProps) {
  const [step, setStep] = useState<'pick' | 'compare' | 'done'>('pick')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [primaryFull, setPrimaryFull] = useState<Record<string, any> | null>(null)
  const [secondaryFull, setSecondaryFull] = useState<Record<string, any> | null>(null)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [choices, setChoices] = useState<Record<string, 'primary' | 'secondary'>>({})
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const props = objectType === 'client' ? CLIENT_PROPS : CONTACT_PROPS

  const fetchRecord = useCallback(async (id: string): Promise<Record<string, any> | null> => {
    const url = objectType === 'client' ? `/api/clients/${id}` : `/api/contacts/merge?id=${id}`
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [objectType])

  // Search candidates for the secondary record (excluding the primary)
  const runSearch = useCallback(async (q: string) => {
    setSearching(true)
    setError(null)
    try {
      let items: any[] = []
      if (objectType === 'client') {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=10`)
        const d = await res.json()
        items = Array.isArray(d?.clients) ? d.clients : []
      } else {
        const res = await fetch(`/api/contacts/merge?q=${encodeURIComponent(q)}`)
        const d = await res.json()
        items = Array.isArray(d?.contacts) ? d.contacts : []
      }
      setResults(items.filter(r => r.id !== primary.id))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [objectType, primary.id])

  useEffect(() => { runSearch('') }, [runSearch])

  const onQueryChange = (q: string) => {
    setQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 300)
  }

  const pickSecondary = async (rec: any) => {
    setLoadingRecords(true)
    setError(null)
    const [p, s] = await Promise.all([fetchRecord(primary.id), fetchRecord(rec.id)])
    setLoadingRecords(false)
    if (!p || !s) {
      setError('Failed to load records for comparison')
      return
    }
    setPrimaryFull(p)
    setSecondaryFull(s)
    // HubSpot default: keep primary's value; fall back to secondary when
    // primary is empty
    const defaults: Record<string, 'primary' | 'secondary'> = {}
    for (const def of props) {
      defaults[def.key] = isEmpty(p[def.key]) && !isEmpty(s[def.key]) ? 'secondary' : 'primary'
    }
    setChoices(defaults)
    setStep('compare')
  }

  // Only compare properties whose values actually differ
  const diffProps = props.filter(def => {
    if (!primaryFull || !secondaryFull) return false
    const a = formatValue(primaryFull[def.key])
    const b = formatValue(secondaryFull[def.key])
    return a !== b && !(a === '' && b === '')
  })

  const confirmMerge = async () => {
    if (!secondaryFull) return
    setMerging(true)
    setError(null)
    const propertyChoices: Record<string, 'primary' | 'secondary'> = {}
    for (const def of diffProps) propertyChoices[def.key] = choices[def.key] || 'primary'
    const url = objectType === 'client' ? `/api/clients/${primary.id}/merge` : '/api/contacts/merge'
    const body = objectType === 'client'
      ? { secondary_id: secondaryFull.id, property_choices: propertyChoices }
      : { primary_id: primary.id, secondary_id: secondaryFull.id, property_choices: propertyChoices }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Merge failed')
      setStep('done')
    } catch (e: any) {
      setError(e?.message || 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  const typeLabel = objectType === 'client' ? 'client' : 'contact'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#0f1929] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <GitMerge className="h-5 w-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold text-white capitalize">Merge {typeLabel}s</h2>
              <p className="text-xs text-slate-500">Primary: {recordLabel(objectType, primaryFull) || recordLabel(objectType, primary)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning banner */}
        {step !== 'done' && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 shrink-0">
            The primary record will be kept. This cannot be undone.
          </div>
        )}

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {/* Step 1: pick secondary */}
        {step === 'pick' && (
          <div className="p-5 flex flex-col gap-3 overflow-y-auto">
            <p className="text-xs text-slate-400">Select the {typeLabel} to merge into <span className="text-slate-200 font-medium">{recordLabel(objectType, primary)}</span>. Its data will be combined and the duplicate deleted.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                autoFocus
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder={`Search ${typeLabel}s…`}
                className="w-full bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition"
              />
            </div>
            {searching || loadingRecords ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No matching {typeLabel}s found.</p>
            ) : (
              <div className="flex flex-col rounded-xl border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => pickSecondary(r)}
                    className="flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{recordLabel(objectType, r)}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {[r.email, r.phone, objectType === 'client' ? r.website : null].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <GitMerge className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: side-by-side comparison */}
        {step === 'compare' && primaryFull && secondaryFull && (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs text-slate-400 mb-3">
                Click a value to keep it on the merged record. Only properties that differ are shown.
              </p>
              <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                <div className="grid grid-cols-[minmax(90px,1fr)_2fr_2fr] text-xs font-semibold text-slate-400 bg-white/[0.04] border-b border-white/[0.07]">
                  <div className="px-3 py-2.5">Property</div>
                  <div className="px-3 py-2.5 text-sky-300">Primary (kept)</div>
                  <div className="px-3 py-2.5">Secondary (deleted)</div>
                </div>
                {diffProps.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-500 text-center">
                    No conflicting properties — the records will simply be combined.
                  </p>
                ) : (
                  diffProps.map(def => {
                    const pVal = formatValue(primaryFull[def.key])
                    const sVal = formatValue(secondaryFull[def.key])
                    const sel = choices[def.key] || 'primary'
                    const cellClass = (side: 'primary' | 'secondary') =>
                      `px-3 py-2.5 text-xs text-left break-words transition-colors border-l border-white/[0.05] ${
                        sel === side
                          ? 'bg-sky-500/15 text-white ring-1 ring-inset ring-sky-500/40'
                          : 'text-slate-400 hover:bg-white/[0.05]'
                      }`
                    return (
                      <div key={def.key} className="grid grid-cols-[minmax(90px,1fr)_2fr_2fr] border-b border-white/[0.05] last:border-0">
                        <div className="px-3 py-2.5 text-xs text-slate-500">{def.label}</div>
                        <button type="button" onClick={() => setChoices(c => ({ ...c, [def.key]: 'primary' }))} className={cellClass('primary')}>
                          {pVal || <span className="italic text-slate-600">empty</span>}
                        </button>
                        <button type="button" onClick={() => setChoices(c => ({ ...c, [def.key]: 'secondary' }))} className={cellClass('secondary')}>
                          {sVal || <span className="italic text-slate-600">empty</span>}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.08] shrink-0">
              <button
                onClick={() => { setStep('pick'); setSecondaryFull(null); setError(null) }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={confirmMerge}
                disabled={merging}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                {merging ? 'Merging…' : `Merge ${typeLabel}s`}
              </button>
            </div>
          </>
        )}

        {/* Success */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-5">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">Records merged</p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              {recordLabel(objectType, secondaryFull)} was merged into {recordLabel(objectType, primaryFull) || recordLabel(objectType, primary)}.
            </p>
            <button
              onClick={() => onMerged(primary.id)}
              className="mt-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
