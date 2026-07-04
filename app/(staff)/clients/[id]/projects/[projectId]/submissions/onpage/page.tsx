'use client'
import { useState, useEffect, KeyboardEvent } from 'react'
import { Plus, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'

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
  comment: '',
})

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
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 border border-white/[0.12] rounded-lg bg-[rgba(255,255,255,0.06)] min-h-[42px] focus-within:ring-2 focus-within:ring-sky-500/50">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/20 text-sky-300 text-sm rounded-full border border-sky-500/25">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-sky-200">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[100px] text-sm outline-none bg-transparent text-white placeholder:text-slate-500"
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

export default function OnPagePage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/onpage`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .finally(() => setLoading(false))
  }, [params.projectId])
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
      comment: entry.comment || '',
    })
    setShowForm(true)
  }
  const closeModal = () => { setShowForm(false); setEditEntry(null) }

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

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/onpage/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setEntries(p => p.filter(x => x.id !== deleteId))
        setDeleteId(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="glass-card">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">OnPage Details ({entries.length})</h2>
          <button
            onClick={openAdd}
            className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add OnPage Detail
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No OnPage details yet</p>
            <p className="text-sm mt-1">Click "Add OnPage Detail" to log your first entry</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'URL', 'H1', 'Meta Title', 'Primary KWs', 'Rankings', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">{entry.url}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate text-slate-300">{entry.h1}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-slate-300">{entry.meta_title}</td>
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
                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">{entry.rankings}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.submission_date}</td>
                    <td className="px-4 py-3">
                      {deleteId === entry.id ? (
                        <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-2 py-1">
                          <span className="text-red-400">Delete?</span>
                          <button onClick={() => setDeleteId(null)} className="px-2 py-0.5 border border-white/[0.10] rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-60">
                            {deleting ? '...' : 'Delete'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(entry)} className="p-1 text-slate-400 hover:text-sky-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteId(entry.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-white/[0.06] flex flex-wrap gap-2">
          <button className="btn-brand flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Send className="h-3.5 w-3.5" /> Send to All
          </button>
          <button className="px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Send to DM Manager</button>
          <button className="px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Send to Sales Manager</button>
          <button className="px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Send to Client</button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">{editEntry ? 'Edit OnPage Detail' : 'Add OnPage Detail'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">URL <span className="text-red-400">*</span></label>
                <input className="input-glass" type="url" value={form.url} onChange={set('url')} placeholder="https://..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">H1 <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.h1} onChange={set('h1')} placeholder="Page heading" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Meta Title
                  <span className={`ml-2 font-normal ${form.meta_title.length > 60 ? 'text-red-400' : 'text-slate-500'}`}>
                    {form.meta_title.length}/60
                  </span>
                </label>
                <input className="input-glass" value={form.meta_title} onChange={set('meta_title')} placeholder="SEO title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
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
                <label className="block text-sm font-medium text-slate-300 mb-1">Rankings</label>
                <input className="input-glass" value={form.rankings} onChange={set('rankings')} placeholder="e.g. #3 for keyword X" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Submission Date</label>
                <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Comment</label>
                <textarea className="input-glass resize-none h-16" value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Cancel</button>
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
