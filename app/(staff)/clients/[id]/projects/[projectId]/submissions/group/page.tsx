'use client'
import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'

const PLATFORMS = [
  'Facebook Group', 'LinkedIn Group', 'Reddit', 'Nextdoor',
  'Discord', 'Telegram', 'WhatsApp', 'Other',
]
const POST_TYPES = ['Text', 'Image', 'Video', 'Link Share', 'Event Promo', 'Poll']
const STATUSES = ['Live', 'Under Review', 'Deleted', 'Pending Approval']

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

const statusColors: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  under_review: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  deleted: 'bg-red-500/15 text-red-400 border border-red-500/25',
  pending_approval: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
}

function today() { return new Date().toISOString().split('T')[0] }

const emptyForm = () => ({
  platform: '',
  group_name: '',
  group_url: '',
  post_type: 'text',
  post_content: '',
  live_link: '',
  status: 'live',
  submission_date: today(),
  username: '',
  password: '',
  member_count: '',
  comment: '',
})

export default function GroupPage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/group-postings`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .finally(() => setLoading(false))
  }, [params.projectId])
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (entry: any) => {
    setEditEntry(entry)
    setForm({
      platform: entry.platform || '',
      group_name: entry.group_name || '',
      group_url: entry.group_url || '',
      post_type: entry.post_type || 'text',
      post_content: entry.post_content || '',
      live_link: entry.live_link || '',
      status: entry.status || 'live',
      submission_date: entry.submission_date || today(),
      username: entry.username || '',
      password: '',
      member_count: entry.member_count ? String(entry.member_count) : '',
      comment: entry.comment || '',
    })
    setShowForm(true)
  }
  const closeModal = () => { setShowForm(false); setEditEntry(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, status: form.status.toLowerCase().replace(/ /g, '_') }
      if (editEntry) {
        const res = await fetch(`/api/projects/${params.projectId}/group-postings/${editEntry.id}`, {
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
        const res = await fetch(`/api/projects/${params.projectId}/group-postings`, {
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
      const res = await fetch(`/api/projects/${params.projectId}/group-postings/${deleteId}`, { method: 'DELETE' })
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
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">Group Postings ({entries.length})</h2>
          <button
            onClick={openAdd}
            className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Group Post
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No group postings yet</p>
            <p className="text-sm mt-1">Click "Add Group Post" to log your first group posting</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'Platform', 'Group Name', 'Post Type', 'Status', 'Live Link', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-white">{entry.platform}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate text-slate-300">{entry.group_name}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{entry.post_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status] || ''}`}>
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.live_link && (
                        <a href={entry.live_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </td>
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
              <h3 className="text-lg font-semibold text-white">{editEntry ? 'Edit Group Posting' : 'Add Group Posting'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Platform <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.platform} onChange={set('platform')} required>
                    <option value="">Select...</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Post Type <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.post_type} onChange={set('post_type')} required>
                    {POST_TYPES.map(t => <option key={t} value={t.toLowerCase().replace(' ', '_')}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Group Name <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.group_name} onChange={set('group_name')} placeholder="Group or community name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Group URL</label>
                <input className="input-glass" type="url" value={form.group_url} onChange={set('group_url')} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Post Content <span className="text-red-400">*</span></label>
                <textarea className="input-glass resize-none h-24" value={form.post_content} onChange={set('post_content')} placeholder="What was posted..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Live Link</label>
                <input className="input-glass" type="url" value={form.live_link} onChange={set('live_link')} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUSES.map(s => <option key={s} value={s.toLowerCase().replace(/ /g, '_')}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Submission Date <span className="text-red-400">*</span></label>
                  <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <input className="input-glass" value={form.username} onChange={set('username')} placeholder="Username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <input className="input-glass" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Member Count</label>
                <input className="input-glass" type="number" value={form.member_count} onChange={set('member_count')} placeholder="e.g. 5000" />
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
