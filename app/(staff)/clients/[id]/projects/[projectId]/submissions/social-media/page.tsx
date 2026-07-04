'use client'
import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'

const PLATFORMS = [
  'YouTube', 'TikTok', 'Instagram Reels', 'Instagram Post', 'Snapchat',
  'Facebook Post', 'Facebook Watch', 'LinkedIn', 'Twitter/X', 'Threads',
  'Pinterest', 'Rumble', 'Linktree', 'Google Business Profile', 'Locals',
  'IGTV', 'Vimeo', 'Dailymotion', 'Twitch',
]
const TYPES = ['Image', 'Video', 'Carousel', 'GIF']
const STATUSES = ['Live', 'Under Review', 'Deleted']

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

const statusColors: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  under_review: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  deleted: 'bg-red-500/15 text-red-400 border border-red-500/25',
}

function today() { return new Date().toISOString().split('T')[0] }

const emptyForm = () => ({
  platform: '', type: 'image', status: 'live', live_link: '',
  submission_date: today(), username: '', password: '', comment: '',
})

export default function SocialMediaPage({ params }: { params: { id: string; projectId: string } }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/social-media`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPosts(data) })
      .finally(() => setLoading(false))
  }, [params.projectId])
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [showPassword, setShowPassword] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (post: any) => {
    setEditEntry(post)
    setForm({
      platform: post.platform || '',
      type: post.type || 'image',
      status: post.status || 'live',
      live_link: post.live_link || '',
      submission_date: post.submission_date || today(),
      username: post.username || '',
      password: '',
      comment: post.comment || '',
    })
    setShowForm(true)
  }
  const closeModal = () => { setShowForm(false); setEditEntry(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, status: form.status.toLowerCase().replace(' ', '_') }
      if (editEntry) {
        const res = await fetch(`/api/projects/${params.projectId}/social-media/${editEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setPosts(p => p.map(x => x.id === editEntry.id ? data : x))
          closeModal()
        }
      } else {
        const res = await fetch(`/api/projects/${params.projectId}/social-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setPosts(p => [data, ...p])
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
      const res = await fetch(`/api/projects/${params.projectId}/social-media/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(p => p.filter(x => x.id !== deleteId))
        setDeleteId(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">Social Media Posts — Monthly Target</span>
          <span className="text-sm text-slate-400">{posts.length}/0</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full" style={{ width: '0%' }} />
        </div>
        <p className="text-xs text-slate-500 mt-1">No target set for this month</p>
      </div>

      {/* Add button + Grid */}
      <div className="glass-card">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">Posts ({posts.length})</h2>
          <button
            onClick={openAdd}
            className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Post
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-1">Click "Add Post" to log your first social media post</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Platform', 'Type', 'Status', 'Live Link', 'Date', 'Comment', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {posts.map(post => (
                  <tr key={post.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-white">{post.platform}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{post.type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status] || ''}`}>
                        {post.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {post.live_link && (
                        <a href={post.live_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{post.submission_date}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate">{post.comment}</td>
                    <td className="px-4 py-3">
                      {deleteId === post.id ? (
                        <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-2 py-1">
                          <span className="text-red-400">Delete?</span>
                          <button onClick={() => setDeleteId(null)} className="px-2 py-0.5 border border-white/[0.10] rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-60">
                            {deleting ? '...' : 'Delete'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(post)} className="p-1 text-slate-400 hover:text-sky-400"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteId(post.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Email send footer */}
        <div className="p-4 border-t border-white/[0.06] flex flex-wrap gap-2">
          <button className="btn-brand flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Send className="h-3.5 w-3.5" /> Send to All
          </button>
          <button className="px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Send to DM Manager</button>
          <button className="px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Send to Sales Manager</button>
          <button className="px-3 py-1.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Send to Client</button>
        </div>
      </div>

      {/* Add/Edit Post Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">{editEntry ? 'Edit Social Media Post' : 'Add Social Media Post'}</h3>
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
                  <label className="block text-sm font-medium text-slate-300 mb-1">Type <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.type} onChange={set('type')} required>
                    {TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUSES.map(s => <option key={s} value={s.toLowerCase().replace(' ', '_')}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Submission Date <span className="text-red-400">*</span></label>
                  <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Live Link</label>
                <input className="input-glass" type="url" value={form.live_link} onChange={set('live_link')} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <input className="input-glass" value={form.username} onChange={set('username')} placeholder="@handle" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <input className="input-glass" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Comment</label>
                <textarea className="input-glass resize-none h-20" value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-white/[0.10] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 btn-brand disabled:opacity-60 text-sm font-medium">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : editEntry ? 'Update Post' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
