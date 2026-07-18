'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'

// A single-select input that offers existing options (type-ahead filtered)
// but also accepts a brand-new value the user types and doesn't find in the
// list — used for Masters-backed fields (Industry, etc.) so a new value
// typed once becomes searchable/selectable everywhere else going forward,
// instead of being locked to a fixed list or a disconnected free-text field.
export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  className,
  required,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  className?: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  }, [options, query])

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase())
  const canCreate = query.trim().length > 0 && !exactMatch

  function select(v: string) {
    onChange(v)
    setQuery(v)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <input
          className="input-glass pr-9 w-full"
          value={query}
          placeholder={placeholder}
          required={required}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); select(query.trim() || filtered[0] || '') }
            if (e.key === 'Escape') { setOpen(false); setQuery(value) }
          }}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-900/10 dark:border-white/[0.12] bg-white dark:bg-[#0f1929] shadow-2xl">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => select(o)}
              className="w-full flex items-center justify-between text-left px-3.5 py-2.5 text-sm hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] text-slate-900 dark:text-white transition-colors"
            >
              {o}
              {o === value && <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => select(query.trim())}
              className="w-full flex items-center gap-2 text-left px-3.5 py-2.5 text-sm text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 border-t border-slate-900/10 dark:border-white/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" /> Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <div className="px-3.5 py-2.5 text-sm text-slate-500">No matches</div>
          )}
        </div>
      )}
    </div>
  )
}
