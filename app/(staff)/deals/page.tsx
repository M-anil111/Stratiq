'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus, X, Target, AlertTriangle, UserPlus, ExternalLink, Download, CheckSquare, Square, GripVertical,
  Search, KanbanSquare, List as ListIcon, LayoutGrid, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import SlideOver from '@/components/SlideOver'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

type Lead = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  source: string | null
  stage: string
  estimated_value: number | null
  notes: string | null
  converted_client_id: string | null
  created_at: string
}

const STAGES = [
  { key: 'prospect', label: 'Prospect', accent: 'text-slate-700 dark:text-slate-300' },
  { key: 'contacted', label: 'Contacted', accent: 'text-sky-600 dark:text-sky-400' },
  { key: 'proposal_sent', label: 'Proposal Sent', accent: 'text-amber-600 dark:text-amber-400' },
  { key: 'won', label: 'Won', accent: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'lost', label: 'Lost', accent: 'text-red-600 dark:text-red-400' },
] as const

// Stage -> pill classes, mirroring the accent color mapping used for the kanban columns above.
const STAGE_PILL_CLASSES: Record<string, string> = {
  prospect: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  contacted: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25',
  proposal_sent: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  won: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  lost: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
}

const EMPTY_FORM = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  source: '',
  stage: 'prospect',
  estimated_value: '',
  notes: '',
}

type FormState = typeof EMPTY_FORM

type ViewMode = 'board' | 'list' | 'grid'
const VIEW_KEY = 'stratiq-deals-view'

type SortKey = 'company_name' | 'contact_name' | 'email' | 'stage' | 'estimated_value' | 'created_at'
type SortDir = 'asc' | 'desc'

function formatValue(value: number | null) {
  if (value == null) return null
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function leadToForm(lead: Lead): FormState {
  return {
    company_name: lead.company_name || '',
    contact_name: lead.contact_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    website: lead.website || '',
    source: lead.source || '',
    stage: lead.stage,
    estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
    notes: lead.notes || '',
  }
}

function stageLabel(stage: string) {
  return STAGES.find(s => s.key === stage)?.label || stage
}

function StagePill({ stage }: { stage: string }) {
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[11px] font-medium border', STAGE_PILL_CLASSES[stage] || STAGE_PILL_CLASSES.prospect)}>
      {stageLabel(stage)}
    </span>
  )
}

function LeadCard({
  lead,
  onEdit,
  onStageChange,
  onConvert,
  converting,
  selected,
  onToggleSelect,
  dragHandleProps,
  dragHandleListeners,
  isDragging,
}: {
  lead: Lead
  onEdit: (lead: Lead) => void
  onStageChange: (lead: Lead, stage: string) => void
  onConvert: (lead: Lead) => void
  converting: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  dragHandleListeners?: Record<string, unknown>
  isDragging?: boolean
}) {
  const value = formatValue(lead.estimated_value)
  const canConvert = (lead.stage === 'proposal_sent' || lead.stage === 'won') && !lead.converted_client_id
  return (
    <div className={cn('glass-card rounded-xl p-3 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-200 flex gap-2', selected && 'ring-1 ring-sky-500/50 bg-sky-500/[0.05]', isDragging && 'opacity-50')}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(lead.id) }}
        aria-label={selected ? 'Deselect deal' : 'Select deal'}
        className="shrink-0 pt-0.5 text-slate-500 hover:text-sky-400 transition-colors"
      >
        {selected ? <CheckSquare className="h-4 w-4 text-sky-400" /> : <Square className="h-4 w-4" />}
      </button>
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          {...(dragHandleListeners || {})}
          aria-label="Drag to move stage"
          className="shrink-0 pt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
      <button onClick={() => onEdit(lead)} className="w-full text-left">
        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{lead.company_name}</div>
        {lead.contact_name && <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{lead.contact_name}</div>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {value && (
            <span className="inline-flex px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              {value}
            </span>
          )}
          {lead.source && (
            <span className="inline-flex px-1.5 py-0.5 rounded-md text-[11px] bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-900/10 dark:border-white/[0.08]">
              {lead.source}
            </span>
          )}
          <span className="text-[11px] text-slate-500">{timeAgo(lead.created_at)}</span>
        </div>
      </button>

      <div className="mt-2.5 flex items-center gap-2">
        <select
          value={lead.stage}
          onClick={e => e.stopPropagation()}
          onChange={e => onStageChange(lead, e.target.value)}
          className="input-glass flex-1 min-w-0 px-2 py-1 rounded-lg text-[11px]"
          aria-label="Move stage"
        >
          {STAGES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        {canConvert && (
          <button
            onClick={() => onConvert(lead)}
            disabled={converting}
            title="Convert to Client"
            className="btn-brand shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium disabled:opacity-50"
          >
            <UserPlus className="h-3 w-3" />
            {converting ? 'Converting…' : 'Convert'}
          </button>
        )}
        {lead.converted_client_id && (
          <Link
            href={`/clients/${lead.converted_client_id}`}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Client
          </Link>
        )}
      </div>
      </div>
    </div>
  )
}

function DraggableLeadCard(props: {
  lead: Lead
  onEdit: (lead: Lead) => void
  onStageChange: (lead: Lead, stage: string) => void
  onConvert: (lead: Lead) => void
  converting: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  const { lead } = props
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { stage: lead.stage },
  })
  return (
    <div ref={setNodeRef}>
      <LeadCard
        {...props}
        isDragging={isDragging}
        dragHandleProps={attributes as unknown as React.HTMLAttributes<HTMLButtonElement>}
        dragHandleListeners={listeners}
      />
    </div>
  )
}

function DroppableColumn({
  stageKey,
  children,
  className,
}: {
  stageKey: string
  children: React.ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && 'ring-2 ring-sky-500/60 bg-sky-500/[0.06] dark:bg-sky-500/[0.08]'
      )}
    >
      {children}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="skeleton h-3.5 w-2/3 rounded mb-2" />
      <div className="skeleton h-3 w-1/2 rounded mb-2" />
      <div className="skeleton h-6 w-full rounded-lg" />
    </div>
  )
}

function LeadFormFields({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Company</label>
        <input
          autoFocus
          required
          value={form.company_name}
          onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
          placeholder="Acme Inc."
          className="input-glass w-full px-3 py-2 rounded-xl text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Contact name</label>
          <input
            value={form.contact_name}
            onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Phone</label>
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Website</label>
          <input
            value={form.website}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            placeholder="https://"
            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Source</label>
          <input
            value={form.source}
            onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            placeholder="Referral, website…"
            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Estimated value ($)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={form.estimated_value}
            onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Stage</label>
        <select
          value={form.stage}
          onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
          className="input-glass w-full px-3 py-2 rounded-xl text-sm"
        >
          {STAGES.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="input-glass w-full px-3 py-2 rounded-xl text-sm resize-none"
        />
      </div>
    </>
  )
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <th className={cn('text-left px-3 py-2 select-none', className)}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-slate-900 dark:hover:text-white transition-colors',
          active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  )
}

export default function DealsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStage, setBulkStage] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Load persisted view mode once on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_KEY)
      if (stored === 'board' || stored === 'list' || stored === 'grid') setViewMode(stored)
    } catch { /* ignore */ }
  }, [])

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode)
    try { window.localStorage.setItem(VIEW_KEY, mode) } catch { /* ignore */ }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const fetchLeads = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true)
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      if (data?.__unavailable) {
        setUnavailable(true)
        setLeads([])
      } else {
        setUnavailable(false)
        setLeads(Array.isArray(data) ? data : [])
      }
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const sources = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => { if (l.source) set.add(l.source) })
    return Array.from(set).sort()
  }, [leads])

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter(l => {
      if (stageFilter && l.stage !== stageFilter) return false
      if (sourceFilter && l.source !== sourceFilter) return false
      if (q) {
        const haystack = [l.company_name, l.contact_name, l.email].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [leads, search, stageFilter, sourceFilter])

  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads]
    const dirMul = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
        case 'company_name':
          av = (a.company_name || '').toLowerCase(); bv = (b.company_name || '').toLowerCase()
          break
        case 'contact_name':
          av = (a.contact_name || '').toLowerCase(); bv = (b.contact_name || '').toLowerCase()
          break
        case 'email':
          av = (a.email || '').toLowerCase(); bv = (b.email || '').toLowerCase()
          break
        case 'stage':
          av = stageLabel(a.stage).toLowerCase(); bv = stageLabel(b.stage).toLowerCase()
          break
        case 'estimated_value':
          av = Number(a.estimated_value) || 0; bv = Number(b.estimated_value) || 0
          break
        case 'created_at':
          av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime()
          break
      }
      if (av < bv) return -1 * dirMul
      if (av > bv) return 1 * dirMul
      return 0
    })
    return list
  }, [filteredLeads, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const columns = useMemo(
    () =>
      STAGES.map(stage => {
        const items = filteredLeads.filter(l => l.stage === stage.key)
        const total = items.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0)
        return { ...stage, items, total }
      }),
    [filteredLeads]
  )

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => { setSelectedIds(new Set()); setBulkStage(''); setBulkMsg('') }

  const toCsvRows = (list: Lead[]) =>
    list.map(l => ({
      company_name: l.company_name || '',
      contact_name: l.contact_name || '',
      email: l.email || '',
      phone: l.phone || '',
      stage: l.stage || '',
      estimated_value: l.estimated_value ?? '',
      source: l.source || '',
    }))

  const exportAll = () => {
    if (!leads.length) return
    downloadCsv(`deals-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows(leads))
  }
  const exportSelected = () => {
    const list = leads.filter(l => selectedIds.has(l.id))
    if (!list.length) return
    downloadCsv(`deals-selected-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows(list))
  }

  async function applyBulkStage() {
    const ids = Array.from(selectedIds)
    if (!bulkStage || !ids.length || bulkBusy) return
    setBulkBusy(true)
    setBulkMsg('')
    let ok = 0
    for (const id of ids) {
      try {
        const res = await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, stage: bulkStage }),
        })
        if (res.ok) ok++
      } catch { /* skip */ }
    }
    setBulkMsg(`Moved ${ok} of ${ids.length}`)
    setBulkBusy(false)
    setSelectedIds(new Set())
    setBulkStage('')
    fetchLeads(false)
  }

  function openNewModal() {
    setEditingLead(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(lead: Lead) {
    setEditingLead(lead)
    setForm(leadToForm(lead))
    setModalOpen(true)
  }

  async function changeStage(lead: Lead, stage: string) {
    if (stage === lead.stage) return
    // Optimistic move
    setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, stage } : l)))
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, stage }),
    })
    if (!res.ok) {
      setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, stage: lead.stage } : l)))
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const targetStage = String(over.id)
    const lead = leads.find(l => l.id === active.id)
    if (!lead) return
    if (!STAGES.some(s => s.key === targetStage)) return
    if (targetStage === lead.stage) return
    changeStage(lead, targetStage)
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) || null : null

  async function convertLead(lead: Lead) {
    if (convertingId) return
    setConvertingId(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data?.client_id) {
        setLeads(prev =>
          prev.map(l => (l.id === lead.id ? { ...l, stage: 'won', converted_client_id: data.client_id } : l))
        )
      }
    } finally {
      setConvertingId(null)
    }
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || saving) return
    setSaving(true)
    try {
      const payload = {
        company_name: form.company_name,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        source: form.source || null,
        stage: form.stage,
        estimated_value: form.estimated_value === '' ? null : Number(form.estimated_value),
        notes: form.notes || null,
      }
      const res = await fetch('/api/leads', {
        method: editingLead ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLead ? { id: editingLead.id, ...payload } : payload),
      })
      if (res.ok) {
        setModalOpen(false)
        setEditingLead(null)
        setForm(EMPTY_FORM)
        fetchLeads(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const VIEW_OPTIONS: { key: ViewMode; label: string; icon: typeof KanbanSquare }[] = [
    { key: 'list', label: 'List', icon: ListIcon },
    { key: 'grid', label: 'Grid', icon: LayoutGrid },
    { key: 'board', label: 'Board', icon: KanbanSquare },
  ]

  return (
    <div className="p-4 lg:p-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Deals</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Track prospects from first touch to signed client</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportAll} disabled={!leads.length}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.1] border border-slate-900/10 dark:border-white/[0.08] transition-colors disabled:opacity-40">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export all</span>
          </button>
          <button onClick={openNewModal} className="btn-brand inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium">
            <Plus className="h-4 w-4" />
            New Deal
          </button>
        </div>
      </div>

      {/* Toolbar: search, filters, view switcher */}
      {!unavailable && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search company, contact, email…"
              className="input-glass w-full pl-8 pr-3 py-2 rounded-xl text-sm"
            />
          </div>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="input-glass px-3 py-2 rounded-xl text-sm"
            aria-label="Filter by stage"
          >
            <option value="">All stages</option>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="input-glass px-3 py-2 rounded-xl text-sm"
            aria-label="Filter by source"
          >
            <option value="">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="ml-auto inline-flex items-center rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/[0.08] p-0.5">
            {VIEW_OPTIONS.map(opt => {
              const Icon = opt.icon
              const active = viewMode === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => changeViewMode(opt.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {unavailable ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <h2 className="text-slate-900 dark:text-white font-medium mb-1">Deals not enabled</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Run migration 023 to enable the deal pipeline</p>
        </div>
      ) : !loading && leads.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Target className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <h2 className="text-slate-900 dark:text-white font-medium mb-1">No deals yet</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Add your first prospect to start building the pipeline.</p>
          <button onClick={openNewModal} className="btn-brand inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium">
            <Plus className="h-4 w-4" />
            New Deal
          </button>
        </div>
      ) : !loading && filteredLeads.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Search className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <h2 className="text-slate-900 dark:text-white font-medium mb-1">No matching deals</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Try adjusting your search or filters.</p>
        </div>
      ) : viewMode === 'board' ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-2">
            <div className="flex sm:grid sm:grid-cols-5 gap-3 sm:min-w-[900px]">
              {columns.map(col => (
                <div key={col.key} className="flex flex-col gap-2 min-w-[80%] sm:min-w-0 shrink-0 sm:shrink">
                  <div className="px-1 flex items-baseline justify-between gap-2">
                    <h2 className={cn('text-xs font-semibold uppercase tracking-wider truncate', col.accent)}>
                      {col.label}
                      <span className="ml-1.5 text-slate-500 font-normal">{loading ? '—' : col.items.length}</span>
                    </h2>
                    {!loading && col.total > 0 && (
                      <span className="text-[11px] text-slate-500 shrink-0">{formatValue(col.total)}</span>
                    )}
                  </div>
                  <DroppableColumn
                    stageKey={col.key}
                    className="flex flex-col gap-2 rounded-2xl bg-slate-900/[0.03] dark:bg-white/[0.02] border border-slate-900/10 dark:border-white/[0.05] p-2 min-h-[120px] transition-colors duration-150"
                  >
                    {loading ? (
                      <>
                        <SkeletonCard />
                        <SkeletonCard />
                      </>
                    ) : col.items.length === 0 ? (
                      <div className="text-[11px] text-slate-600 text-center py-6">No deals</div>
                    ) : (
                      col.items.map(lead => (
                        <DraggableLeadCard
                          key={lead.id}
                          lead={lead}
                          onEdit={openEditModal}
                          onStageChange={changeStage}
                          onConvert={convertLead}
                          converting={convertingId === lead.id}
                          selected={selectedIds.has(lead.id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))
                    )}
                  </DroppableColumn>
                </div>
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeLead ? (
              <div className="w-64">
                <LeadCard
                  lead={activeLead}
                  onEdit={() => {}}
                  onStageChange={() => {}}
                  onConvert={() => {}}
                  converting={false}
                  selected={false}
                  onToggleSelect={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : viewMode === 'grid' ? (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sortedLeads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onEdit={openEditModal}
                onStageChange={changeStage}
                onConvert={convertLead}
                converting={convertingId === lead.id}
                selected={selectedIds.has(lead.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )
      ) : (
        // List (table) view
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-slate-900/10 dark:border-white/[0.08]">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <SortHeader label="Company" sortKey="company_name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Contact" sortKey="contact_name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Stage" sortKey="stage" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Estimated Value" sortKey="estimated_value" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Created" sortKey="created_at" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-900/[0.05] dark:border-white/[0.04]">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="skeleton h-4 w-full rounded" />
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedLeads.map(lead => {
                    const canConvert = (lead.stage === 'proposal_sent' || lead.stage === 'won') && !lead.converted_client_id
                    const selected = selectedIds.has(lead.id)
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          'border-b border-slate-900/[0.05] dark:border-white/[0.04] hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02] transition-colors',
                          selected && 'bg-sky-500/[0.05]'
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => toggleSelect(lead.id)}
                            aria-label={selected ? 'Deselect deal' : 'Select deal'}
                            className="text-slate-500 hover:text-sky-400 transition-colors"
                          >
                            {selected ? <CheckSquare className="h-4 w-4 text-sky-400" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => openEditModal(lead)} className="text-sm font-medium text-slate-900 dark:text-white hover:underline text-left">
                            {lead.company_name}
                          </button>
                          {lead.website && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{lead.website}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">{lead.contact_name || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">{lead.email || '—'}</td>
                        <td className="px-3 py-2.5">
                          <select
                            value={lead.stage}
                            onChange={e => changeStage(lead, e.target.value)}
                            className="input-glass px-2 py-1 rounded-lg text-[11px]"
                            aria-label="Move stage"
                          >
                            {STAGES.map(s => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">
                          {formatValue(lead.estimated_value) || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-500 whitespace-nowrap">{timeAgo(lead.created_at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {canConvert && (
                              <button
                                onClick={() => convertLead(lead)}
                                disabled={convertingId === lead.id}
                                title="Convert to Client"
                                className="btn-brand inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium disabled:opacity-50 whitespace-nowrap"
                              >
                                <UserPlus className="h-3 w-3" />
                                {convertingId === lead.id ? 'Converting…' : 'Convert'}
                              </button>
                            )}
                            {lead.converted_client_id && (
                              <Link
                                href={`/clients/${lead.converted_client_id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Client
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New / Edit Deal slide-over */}
      <SlideOver
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLead ? 'Edit Deal' : 'New Deal'}
      >
        <form id="lead-form" onSubmit={saveLead} className="space-y-4">
          <LeadFormFields form={form} setForm={setForm} />
        </form>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-900/[0.04] dark:bg-white/[0.06] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.1] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="lead-form"
            disabled={saving || !form.company_name.trim()}
            className="btn-brand px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingLead ? 'Save Changes' : 'Create Deal'}
          </button>
        </div>
      </SlideOver>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-3 z-40 mt-4">
          <div className="glass-card rounded-2xl px-3 py-2.5 flex flex-wrap items-center gap-2 shadow-2xl border border-sky-500/20 bg-sky-500/[0.08]">
            <span className="text-xs font-medium text-slate-900 dark:text-white">{selectedIds.size} selected</span>
            <button onClick={exportSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.1] transition-colors">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
              className="input-glass px-2 py-1.5 rounded-lg text-xs">
              <option value="">Move to stage…</option>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button onClick={applyBulkStage} disabled={!bulkStage || bulkBusy}
              className="btn-brand inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40">
              {bulkBusy ? 'Moving…' : 'Apply'}
            </button>
            <button onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
            {bulkMsg && <span className="text-xs text-emerald-400 ml-auto">{bulkMsg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
