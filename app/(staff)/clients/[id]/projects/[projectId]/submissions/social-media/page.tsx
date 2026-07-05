'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, Send, Eye, EyeOff, CheckSquare, Square } from 'lucide-react'

const PLATFORMS = [
  'Facebook Post', 'Instagram Post', 'Instagram Reels', 'Twitter/X', 'LinkedIn',
  'TikTok', 'Google Business Profile', 'YouTube', 'Snapchat', 'Threads',
  'Pinterest', 'Rumble', 'IGTV', 'Facebook Watch', 'Vimeo', 'Dailymotion', 'Twitch', 'Locals', 'Linktree',
]

const PLATFORM_TABS = [
  { label: 'All', value: '' },
  { label: 'Facebook', value: 'Facebook Post' },
  { label: 'Instagram', value: 'Instagram Post' },
  { label: 'Twitter/X', value: 'Twitter/X' },
  { label: 'LinkedIn', value: 'LinkedIn' },
  { label: 'TikTok', value: 'TikTok' },
  { label: 'Google Business', value: 'Google Business Profile' },
]

const PLATFORM_BADGE: Record<string, string> = {
  'Facebook Post': 'FB',
  'Facebook Watch': 'FW',
  'Instagram Post': 'IG',
  'Instagram Reels': 'IR',
  'Twitter/X': 'TW',
  'LinkedIn': 'LI',
  'TikTok': 'TT',
  'Google Business Profile': 'GB',
  'YouTube': 'YT',
  'Snapchat': 'SC',
  'Threads': 'TH',
  'Pinterest': 'PT',
  'Rumble': 'RU',
  'IGTV': 'TV',
  'Vimeo': 'VM',
  'Dailymotion': 'DM',
  'Twitch': 'TC',
  'Locals': 'LC',
  'Linktree': 'LT',
}

const PLATFORM_COLORS: Record<string, string> = {
  'Facebook Post': 'bg-blue-600/20 text-blue-300',
  'Facebook Watch': 'bg-blue-600/20 text-blue-300',
  'Instagram Post': 'bg-pink-600/20 text-pink-300',
  'Instagram Reels': 'bg-pink-600/20 text-pink-300',
  'Twitter/X': 'bg-slate-500/20 text-slate-300',
  'LinkedIn': 'bg-sky-600/20 text-sky-300',
  'TikTok': 'bg-rose-600/20 text-rose-300',
  'Google Business Profile': 'bg-emerald-600/20 text-emerald-300',
  'YouTube': 'bg-red-600/20 text-red-300',
  'Snapchat': 'bg-yellow-500/20 text-yellow-300',
  'Threads': 'bg-slate-500/20 text-slate-300',
}

const TYPES = ['Image', 'Video', 'Carousel', 'Story', 'Reel', 'GIF']
const STATUSES = ['Draft', 'Scheduled', 'Live', 'Under Review', 'Failed', 'Deleted']
const STATUS_FILTER_TABS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Live', value: 'live' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Failed', value: 'failed' },
]

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  scheduled: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  live: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  under_review: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  failed: 'bg-red-500/15 text-red-400 border border-red-500/25',
  deleted: 'bg-red-500/10 text-red-500 border border-red-500/20',
}

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function today() { return new Date().toISOString().split('T')[0] }

const emptyForm = () => ({
  platform: '', type: 'image', status: 'draft', live_link: '',
  post_content: '', media_url: '', scheduled_date: '', submission_date: today(),
  username: '', password: '', comment: '',
})

export default function SocialMediaPage({ params }: { params: { id: string; projectId: string } }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [showPassword, setShowPassword] = useState(false)

  // Filters
  const [platformTab, setPlatformTab] = useState('')
  const [statusTab, setStatusTab] = useState('')

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params_query: string[] = []
      if (platformTab) params_query.push(`platform=${encodeURIComponent(platformTab)}`)
      if (statusTab) params_query.push(`status=${encodeURIComponent(statusTab)}`)
      const qs = params_query.length ? `?${params_query.join('&')}` : ''
      const res = await fetch(`/api/projects/${params.projectId}/social-media${qs}`)
      if (!res.ok) { setError('Failed to load posts'); return }
      const data = await res.json()
      if (Array.isArray(data)) setPosts(data)
    } catch {
      setError('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [params.projectId, platformTab, statusTab])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // Reset selection when filter changes
  useEffect(() => { setSelected(new Set()) }, [platformTab, statusTab])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (post: any) => {
    setEditEntry(post)
    setForm({
      platform: post.platform || '',
      type: post.type || 'image',
      status: post.status || 'draft',
      live_link: post.live_link || '',
      post_content: post.post_content || '',
      media_url: post.media_url || '',
      scheduled_date: post.scheduled_date || '',
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
      const payload = { ...form, status: form.status.toLowerCase().replace(/ /g, '_') }
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
          await fetchPosts()
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
        setSelected(s => { const n = new Set(s); n.delete(deleteId); return n })
      }
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const toggleAll = () => {
    if (selected.size === posts.length) setSelected(new Set())
    else setSelected(new Set(posts.map(p => p.id)))
  }

  const handleBulkDelete = async () => {
    if (!selected.size) return
    setBulkLoading(true)
    try {
      await Promise.all([...selected].map(id =>
        fetch(`/api/projects/${params.projectId}/social-media/${id}`, { method: 'DELETE' })
      ))
      setPosts(p => p.filter(x => !selected.has(x.id)))
      setSelected(new Set())
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkStatus = async () => {
    if (!selected.size || !bulkStatus) return
    setBulkLoading(true)
    try {
      await Promise.all([...selected].map(id =>
        fetch(`/api/projects/${params.projectId}/social-media`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: bulkStatus }),
        })
      ))
      await fetchPosts()
      setSelected(new Set())
      setBulkStatus('')
    } finally {
      setBulkLoading(false)
    }
  }

  const liveCount = posts.filter(p => p.status === 'live').length
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">Social Media Posts</span>
          <div className="flex gap-4 text-xs text-slate-400">
            <span><span className="text-emerald-400 font-semibold">{liveCount}</span> Live</span>
            <span><span className="text-blue-400 font-semibold">{scheduledCount}</span> Scheduled</span>
            <span><span className="text-white font-semibold">{posts.length}</span> Total</span>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="glass-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">Posts</h2>
          <button onClick={openAdd} className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium">
            <Plus className="h-4 w-4" />
            Add Post
          </button>
        </div>

        {/* Platform tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          {PLATFORM_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setPlatformTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                platformTab === tab.value
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 px-4 pt-2 pb-3 overflow-x-auto border-b border-white/[0.06]">
          {STATUS_FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                statusTab === tab.value
                  ? statusTab
                    ? `${statusColors[tab.value]} !border-0 bg-opacity-30`
                    : 'bg-white/[0.12] text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-sky-500/5 border-b border-sky-500/20">
            <span className="text-xs text-sky-400 font-medium">{selected.size} selected</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-xs bg-white/[0.06] border border-white/[0.10] text-white rounded px-2 py-1"
            >
              <option value="">Change status to...</option>
              {STATUSES.map(s => (
                <option key={s} value={s.toLowerCase().replace(/ /g, '_')}>{s}</option>
              ))}
            </select>
            <button
              onClick={handleBulkStatus}
              disabled={!bulkStatus || bulkLoading}
              className="text-xs px-2 py-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded hover:bg-sky-500/30 disabled:opacity-40 transition-all"
            >
              Apply
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="text-xs px-2 py-1 bg-red-500/15 text-red-400 border border-red-500/25 rounded hover:bg-red-500/25 disabled:opacity-40 transition-all ml-auto"
            >
              {bulkLoading ? 'Working...' : 'Delete Selected'}
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading posts...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">{error}</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No posts found</p>
            <p className="text-sm mt-1">
              {platformTab || statusTab ? 'Try adjusting your filters' : 'Click "Add Post" to log your first social media post'}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {/* Select all row */}
            <div className="flex items-center gap-2 mb-3">
              <button onClick={toggleAll} className="text-slate-400 hover:text-white transition-colors">
                {selected.size === posts.length && posts.length > 0
                  ? <CheckSquare className="h-4 w-4 text-sky-400" />
                  : <Square className="h-4 w-4" />}
              </button>
              <span className="text-xs text-slate-500">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Post cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {posts.map(post => {
                const badge = PLATFORM_BADGE[post.platform] || post.platform?.slice(0, 2).toUpperCase() || '??'
                const badgeColor = PLATFORM_COLORS[post.platform] || 'bg-slate-500/20 text-slate-300'
                const statusKey = (post.status || 'draft').toLowerCase()
                const statusLabel = post.status?.replace(/_/g, ' ') || 'draft'
                const isSelected = selected.has(post.id)
                const dateDisplay = post.scheduled_date || post.submission_date
                  ? new Date(post.scheduled_date || post.submission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : null

                return (
                  <div
                    key={post.id}
                    className={`relative rounded-xl border transition-all ${
                      isSelected
                        ? 'border-sky-500/40 bg-sky-500/5'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-2 p-3 border-b border-white/[0.06]">
                      <button onClick={() => toggleSelect(post.id)} className="text-slate-400 hover:text-white flex-shrink-0 transition-colors">
                        {isSelected ? <CheckSquare className="h-4 w-4 text-sky-400" /> : <Square className="h-4 w-4" />}
                      </button>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${badgeColor}`}>{badge}</span>
                      <span className="text-xs text-slate-400 truncate flex-1">{post.platform}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs border border-white/[0.10] text-slate-400 capitalize">
                        {post.type || 'image'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-3 space-y-2">
                      {post.post_content ? (
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                          {post.post_content.length > 150 ? post.post_content.slice(0, 150) + '…' : post.post_content}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-600 italic">No content</p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center justify-between pt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[statusKey] || ''}`}>
                          {statusLabel}
                        </span>
                        {dateDisplay && (
                          <span className="text-xs text-slate-500">{dateDisplay}</span>
                        )}
                      </div>

                      {/* Engagement */}
                      {(post.likes != null || post.comments_count != null || post.shares != null) && (
                        <div className="flex gap-3 text-xs text-slate-500 pt-1">
                          {post.likes != null && <span>👍 {post.likes}</span>}
                          {post.comments_count != null && <span>💬 {post.comments_count}</span>}
                          {post.shares != null && <span>↗ {post.shares}</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between px-3 pb-3">
                      <div className="flex gap-1">
                        {post.live_link && (
                          <a href={post.live_link} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors rounded">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => openEdit(post)} className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors rounded">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(post.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {deleteId === post.id && (
                        <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                          <span className="text-red-400">Delete?</span>
                          <button onClick={() => setDeleteId(null)} className="px-1.5 py-0.5 border border-white/[0.10] rounded text-slate-400 hover:text-white transition-all">No</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-60">
                            {deleting ? '...' : 'Yes'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
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
                  <label className="block text-sm font-medium text-slate-300 mb-1">Post Type <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.type} onChange={set('type')} required>
                    {TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Content
                  <span className="ml-2 text-xs text-slate-500 font-normal">{form.post_content.length} chars</span>
                </label>
                <textarea
                  className="input-glass resize-none h-24"
                  value={form.post_content}
                  onChange={set('post_content')}
                  placeholder="Post caption or content..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Media URL <span className="text-xs text-slate-500 font-normal">(optional)</span></label>
                <input className="input-glass" type="url" value={form.media_url} onChange={set('media_url')} placeholder="https://... (image or video URL)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUSES.map(s => <option key={s} value={s.toLowerCase().replace(/ /g, '_')}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Scheduled Date/Time</label>
                  <input className="input-glass" type="datetime-local" value={form.scheduled_date} onChange={set('scheduled_date')} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Submission Date <span className="text-red-400">*</span></label>
                <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Live Link <span className="text-xs text-slate-500 font-normal">(optional)</span></label>
                <input className="input-glass" type="url" value={form.live_link} onChange={set('live_link')} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username <span className="text-xs text-slate-500 font-normal">(optional)</span></label>
                  <input className="input-glass" value={form.username} onChange={set('username')} placeholder="@handle" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password <span className="text-xs text-slate-500 font-normal">(optional)</span></label>
                  <div className="relative">
                    <input className="input-glass pr-10" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes <span className="text-xs text-slate-500 font-normal">(optional)</span></label>
                <textarea className="input-glass resize-none h-20" value={form.comment} onChange={set('comment')} placeholder="Optional notes or comments..." />
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
