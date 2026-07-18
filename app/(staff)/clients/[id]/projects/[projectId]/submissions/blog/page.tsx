'use client'
import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2 } from 'lucide-react'

function today() { return new Date().toISOString().split('T')[0] }

const STATUS_OPTIONS = ['draft', 'published', 'scheduled']

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25',
  published: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  scheduled: 'bg-sky-500/15 text-sky-400 border border-sky-500/25',
}

const emptyForm = () => ({
  title: '',
  live_url: '',
  word_count: '',
  status: 'draft',
  submission_date: today(),
  author: '',
  comment: '',
  client_report: true,
})

const selectClass = "w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

export default function BlogPage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/blog`)
      .then(res => res.json())
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [params.projectId])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (entry: any) => {
    setEditEntry(entry)
    setForm({
      title: entry.title || '',
      live_url: entry.live_url || '',
      word_count: entry.word_count != null ? String(entry.word_count) : '',
      status: entry.status || 'draft',
      submission_date: entry.submission_date || today(),
      author: entry.author || '',
      comment: entry.comment || '',
      client_report: entry.client_report !== false,
    })
    setShowForm(true)
  }
  const closeModal = () => { setShowForm(false); setEditEntry(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, word_count: form.word_count ? parseInt(form.word_count) : null }
      if (editEntry) {
        const res = await fetch(`/api/projects/${params.projectId}/blog/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setEntries(p => p.map(x => x.id === editEntry.id ? data : x))
          closeModal()
        }
      } else {
        const res = await fetch(`/api/projects/${params.projectId}/blog`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
      const res = await fetch(`/api/projects/${params.projectId}/blog/${deleteId}`, { method: 'DELETE' })
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
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-900/10 dark:border-white/[0.06]">
          <h2 className="font-semibold text-slate-900 dark:text-white">Blog Submissions ({entries.length})</h2>
          <button onClick={openAdd} className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium">
            <Plus className="h-4 w-4" />
            Add Blog Post
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-600 dark:text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-600 dark:text-slate-400">
            <p className="font-medium">No blog submissions yet</p>
            <p className="text-sm mt-1">Click &quot;Add Blog Post&quot; to log your first blog submission</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'Title', 'URL', 'Words', 'Status', 'Report', 'Published Date', 'Author', 'Notes', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/10 dark:divide-white/[0.06]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[160px] truncate">{entry.title || entry.meta_title}</td>
                    <td className="px-4 py-3">
                      {entry.live_url ? (
                        <a href={entry.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                          <ExternalLink className="h-3 w-3" />View
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.word_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status] || statusColors.draft}`}>
                        {entry.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.client_report !== false ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/25">Client Report</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium text-slate-500">Internal only</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.submission_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.author || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">{entry.comment || '—'}</td>
                    <td className="px-4 py-3">
                      {deleteId === entry.id ? (
                        <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-2 py-1">
                          <span className="text-red-400">Delete?</span>
                          <button onClick={() => setDeleteId(null)} className="px-2 py-0.5 border border-slate-900/10 dark:border-white/[0.10] rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-all">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-60">
                            {deleting ? '...' : 'Delete'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(entry)} className="p-1 text-slate-600 dark:text-slate-400 hover:text-sky-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteId(entry.id)} className="p-1 text-slate-600 dark:text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editEntry ? 'Edit Blog Submission' : 'Add Blog Submission'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Blog Title <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.title} onChange={set('title')} placeholder="Post title" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL</label>
                <input className="input-glass" type="url" value={form.live_url} onChange={set('live_url')} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Word Count</label>
                  <input className="input-glass" type="number" min="0" value={form.word_count} onChange={set('word_count')} placeholder="e.g. 1200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Published Date</label>
                  <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author</label>
                  <input className="input-glass" value={form.author} onChange={set('author')} placeholder="Author name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea className="input-glass resize-none h-20" value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Include in Client Report</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, client_report: !f.client_report }))}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.client_report ? 'bg-sky-500' : 'bg-slate-900/10 dark:bg-white/[0.12]'}`}
                  title="Toggle client report visibility"
                >
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.client_report ? 'translate-x-4' : ''}`} />
                </button>
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
