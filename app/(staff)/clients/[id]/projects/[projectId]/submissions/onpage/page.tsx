'use client'
import { useState, useEffect, KeyboardEvent } from 'react'
import { Plus, Edit2, Trash2, X, Loader2, Send, FileText } from 'lucide-react'

type Status = 'pending' | 'in-progress' | 'completed'
type FilterTab = 'all' | Status

function today() { return new Date().toISOString().split('T')[0] }

const emptyForm = () => ({
  url: '',
  h1: '',
  meta_title: '',
  meta_description: '',
  primary_keywords: [] as string[],
  secondary_keywords: [] as string[],
  rankings: '',
  submission_date: today(),
  status: 'pending' as Status,
  comment: '',
  notes: '',
})

const STATUS_CONFIG: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' },
  'in-progress': { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/25' },
  completed: { label: 'Completed', cls: 'bg-green-500/15 text-green-400 border border-green-500/25' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as Status] ?? { label: status, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25' }
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
}

function TagInput({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
  }
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 border border-slate-900/10 dark:border-white/[0.12] rounded-lg bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] min-h-[42px] focus-within:ring-2 focus-within:ring-sky-500/50">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/20 text-sky-300 text-sm rounded-full border border-sky-500/25">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-sky-200">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[100px] text-sm outline-none bg-transparent text-slate-900 dark:text-white placeholder:text-slate-500"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          placeholder={tags.length === 0 ? 'Type and press Enter...' : ''}
        />
      </div>
    </div>
  )
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3"><div className="h-3 w-4 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3"><div className="h-3 w-36 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3"><div className="h-3 w-28 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3"><div className="h-3 w-32 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" /></td>
          <td className="px-4 py-3 flex gap-1">
            <div className="h-6 w-6 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" />
            <div className="h-6 w-6 bg-slate-900/[0.04] dark:bg-white/[0.08] rounded" />
          </td>
        </tr>
      ))}
    </>
  )
}

export default function OnPagePage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/onpage`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .finally(() => setLoading(false))
  }, [params.projectId])

  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (entry: any) => {
    setEditEntry(entry)
    setForm({
      url: entry.url || '',
      h1: entry.h1 || '',
      meta_title: entry.meta_title || '',
      meta_description: entry.meta_description || '',
      primary_keywords: entry.primary_keywords || [],
      secondary_keywords: entry.secondary_keywords || [],
      rankings: entry.rankings || '',
      submission_date: entry.submission_date || today(),
      status: entry.status || 'pending',
      comment: entry.comment || '',
      notes: entry.notes || '',
    })
    setShowForm(true)
  }
  const closeModal = () => { setShowForm(false); setEditEntry(null) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    const res = await fetch(`/api/projects/${params.projectId}/onpage/${id}`, { method: 'DELETE' })
    if (res.ok) setEntries(p => p.filter(x => x.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editEntry) {
        const res = await fetch(`/api/projects/${params.projectId}/onpage/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const data = await res.json()
          setEntries(p => p.map(x => x.id === editEntry.id ? data : x))
          closeModal()
        }
      } else {
        const res = await fetch(`/api/projects/${params.projectId}/onpage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const data = await res.json()
          setEntries(p => [data, ...p])
          closeModal()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const filtered = activeTab === 'all' ? entries : entries.filter(e => e.status === activeTab)

  const tabCount = (key: FilterTab) => key === 'all' ? entries.length : entries.filter(e => e.status === key).length

  return (
    <div>
      <div className="glass-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-900/10 dark:border-white/[0.06]">
          <h2 className="font-semibold text-slate-900 dark:text-white">OnPage Details ({entries.length})</h2>
          <button
            onClick={openAdd}
            className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add OnPage Detail
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-slate-900/10 dark:border-white/[0.06] pb-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-500'
              }`}>
                {tabCount(tab.key)}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'URL', 'H1', 'Meta Title', 'Status', 'Primary KWs', 'Rankings', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/10 dark:divide-white/[0.06]">
                <SkeletonRows />
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
              <FileText className="h-7 w-7 text-slate-500" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">No onpage entries yet</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {activeTab !== 'all' ? `No entries with status "${STATUS_CONFIG[activeTab as Status]?.label ?? activeTab}"` : 'Get started by adding your first onpage SEO entry'}
              </p>
            </div>
            {activeTab === 'all' && (
              <button onClick={openAdd} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm font-medium mt-1">
                <Plus className="h-4 w-4" />
                Add First Entry
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'URL', 'H1', 'Meta Title', 'Status', 'Primary KWs', 'Rankings', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/10 dark:divide-white/[0.06]">
                {filtered.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[160px] truncate">{entry.url}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate text-slate-700 dark:text-slate-300">{entry.h1}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-slate-700 dark:text-slate-300">{entry.meta_title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status || 'pending'} />
                    </td>
                    <td className="px-4 py-3 max-w-[140px]">
                      <div className="flex flex-wrap gap-1">
                        {(entry.primary_keywords || []).slice(0, 2).map((kw: string) => (
                          <span key={kw} className="px-1.5 py-0.5 bg-sky-500/15 text-sky-400 text-xs rounded border border-sky-500/20">{kw}</span>
                        ))}
                        {(entry.primary_keywords || []).length > 2 && (
                          <span className="text-xs text-slate-500">+{entry.primary_keywords.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">{entry.rankings}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.submission_date}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(entry)} className="p-1 text-slate-600 dark:text-slate-400 hover:text-sky-400 transition-colors" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="p-1 text-slate-600 dark:text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-900/10 dark:border-white/[0.06] flex flex-wrap gap-2">
          <button className="btn-brand flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Send className="h-3.5 w-3.5" /> Send to All
          </button>
          <button className="px-3 py-1.5 rounded-lg border border-slate-900/10 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm">Send to DM Manager</button>
          <button className="px-3 py-1.5 rounded-lg border border-slate-900/10 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm">Send to Sales Manager</button>
          <button className="px-3 py-1.5 rounded-lg border border-slate-900/10 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm">Send to Client</button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editEntry ? 'Edit OnPage Detail' : 'Add OnPage Detail'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL <span className="text-red-400">*</span></label>
                <input className="input-glass" type="url" value={form.url} onChange={set('url')} placeholder="https://..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">H1 <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.h1} onChange={set('h1')} placeholder="Page heading" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Meta Title
                  <span className={`ml-2 font-normal ${form.meta_title.length > 60 ? 'text-red-400' : 'text-slate-500'}`}>
                    {form.meta_title.length}/60
                  </span>
                </label>
                <input className="input-glass" value={form.meta_title} onChange={set('meta_title')} placeholder="SEO title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Meta Description
                  <span className={`ml-2 font-normal ${form.meta_description.length > 160 ? 'text-red-400' : 'text-slate-500'}`}>
                    {form.meta_description.length}/160
                  </span>
                </label>
                <textarea className="input-glass resize-none h-20" value={form.meta_description} onChange={set('meta_description')} placeholder="SEO description" />
              </div>
              <TagInput
                label="Primary Keywords"
                tags={form.primary_keywords}
                onChange={t => setForm(f => ({ ...f, primary_keywords: t }))}
              />
              <TagInput
                label="Secondary Keywords"
                tags={form.secondary_keywords}
                onChange={t => setForm(f => ({ ...f, secondary_keywords: t }))}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rankings</label>
                <input className="input-glass" value={form.rankings} onChange={set('rankings')} placeholder="e.g. #3 for keyword X" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select className="input-glass" value={form.status} onChange={set('status')}>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Submission Date</label>
                <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea className="input-glass resize-none h-16" value={form.notes} onChange={set('notes')} placeholder="Internal notes..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Comment</label>
                <textarea className="input-glass resize-none h-16" value={form.comment} onChange={set('comment')} placeholder="Optional comment..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-slate-900/10 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 btn-brand disabled:opacity-60 text-sm font-medium">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : editEntry ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
