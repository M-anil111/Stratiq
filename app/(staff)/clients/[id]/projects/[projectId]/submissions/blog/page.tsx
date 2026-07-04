'use client'
import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'
import { PasswordField } from '@/components/ui/password-field'

function today() { return new Date().toISOString().split('T')[0] }

const emptyForm = () => ({
  submission_date: today(),
  live_url: '',
  meta_title: '',
  meta_description: '',
  h1: '',
  username: '',
  password: '',
  comment: '',
})

export default function BlogPage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/blog`)
      .then(res => res.json())
      .then(data => setEntries(data || []))
  }, [params.projectId])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (entry: any) => {
    setEditEntry(entry)
    setForm({
      submission_date: entry.submission_date || today(),
      live_url: entry.live_url || '',
      meta_title: entry.meta_title || '',
      meta_description: entry.meta_description || '',
      h1: entry.h1 || '',
      username: entry.username || '',
      password: '',
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
        const res = await fetch(`/api/projects/${params.projectId}/blog/${editEntry.id}`, {
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
        const res = await fetch(`/api/projects/${params.projectId}/blog`, {
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
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">Blog Submissions ({entries.length})</h2>
          <button
            onClick={openAdd}
            className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Blog Post
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No blog submissions yet</p>
            <p className="text-sm mt-1">Click "Add Blog Post" to log your first blog submission</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'Date', 'Live URL', 'Meta Title', 'H1', 'Comment', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.submission_date}</td>
                    <td className="px-4 py-3">
                      {entry.live_url && (
                        <a href={entry.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate font-medium text-white">{entry.meta_title}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-slate-300">{entry.h1}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">{entry.comment}</td>
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
              <h3 className="text-lg font-semibold text-white">{editEntry ? 'Edit Blog Submission' : 'Add Blog Submission'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Submission Date <span className="text-red-400">*</span></label>
                <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Live URL <span className="text-red-400">*</span></label>
                <input className="input-glass" type="url" value={form.live_url} onChange={set('live_url')} placeholder="https://..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Meta Title <span className="text-red-400">*</span>
                  <span className={`ml-2 font-normal ${form.meta_title.length > 60 ? 'text-red-400' : 'text-slate-500'}`}>
                    {form.meta_title.length}/60
                  </span>
                </label>
                <input className="input-glass" value={form.meta_title} onChange={set('meta_title')} placeholder="Page title for SEO" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Meta Description <span className="text-red-400">*</span>
                  <span className={`ml-2 font-normal ${form.meta_description.length > 160 ? 'text-red-400' : 'text-slate-500'}`}>
                    {form.meta_description.length}/160
                  </span>
                </label>
                <textarea className="input-glass resize-none h-20" value={form.meta_description} onChange={set('meta_description')} placeholder="Meta description for SEO" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">H1 <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.h1} onChange={set('h1')} placeholder="Page heading" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <input className="input-glass" value={form.username} onChange={set('username')} placeholder="Username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <PasswordField value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" />
                </div>
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
