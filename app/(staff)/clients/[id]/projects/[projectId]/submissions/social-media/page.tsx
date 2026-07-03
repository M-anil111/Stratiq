'use client'
import { useState } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'

const PLATFORMS = [
  'YouTube', 'TikTok', 'Instagram Reels', 'Instagram Post', 'Snapchat',
  'Facebook Post', 'Facebook Watch', 'LinkedIn', 'Twitter/X', 'Threads',
  'Pinterest', 'Rumble', 'Linktree', 'Google Business Profile', 'Locals',
  'IGTV', 'Vimeo', 'Dailymotion', 'Twitch',
]
const TYPES = ['Image', 'Video', 'Carousel', 'GIF']
const STATUSES = ['Live', 'Under Review', 'Deleted']

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

const statusColors: Record<string, string> = {
  live: 'bg-green-100 text-green-800',
  under_review: 'bg-amber-100 text-amber-800',
  deleted: 'bg-red-100 text-red-800',
}

function today() { return new Date().toISOString().split('T')[0] }

export default function SocialMediaPage({ params }: { params: { id: string; projectId: string } }) {
  const [posts, setPosts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    platform: '', type: 'image', status: 'live', live_link: '',
    submission_date: today(), username: '', password: '', comment: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/social-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: form.status.toLowerCase().replace(' ', '_') }),
      })
      if (res.ok) {
        const data = await res.json()
        setPosts(p => [data, ...p])
        setShowForm(false)
        setForm({ platform: '', type: 'image', status: 'live', live_link: '', submission_date: today(), username: '', password: '', comment: '' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Social Media Posts — Monthly Target</span>
          <span className="text-sm text-gray-500">{posts.length}/0</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full" style={{ width: '0%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">No target set for this month</p>
      </div>

      {/* Add button + Grid */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Posts ({posts.length})</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Post
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-1">Click "Add Post" to log your first social media post</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Platform', 'Type', 'Status', 'Live Link', 'Date', 'Comment', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {posts.map(post => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{post.platform}</td>
                    <td className="px-4 py-3 capitalize">{post.type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status] || ''}`}>
                        {post.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {post.live_link && (
                        <a href={post.live_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-600 hover:text-sky-700">
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{post.submission_date}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{post.comment}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="p-1 text-gray-400 hover:text-sky-600"><Edit2 className="h-4 w-4" /></button>
                        <button className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Email send footer */}
        <div className="p-4 border-t border-gray-100 flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-colors">
            <Send className="h-3.5 w-3.5" /> Send to All
          </button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to DM Manager</button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to Sales Manager</button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to Client</button>
        </div>
      </div>

      {/* Add Post Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">Add Social Media Post</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform <span className="text-red-500">*</span></label>
                  <select className={selectClass} value={form.platform} onChange={set('platform')} required>
                    <option value="">Select...</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select className={selectClass} value={form.type} onChange={set('type')} required>
                    {TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUSES.map(s => <option key={s} value={s.toLowerCase().replace(' ', '_')}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date <span className="text-red-500">*</span></label>
                  <input className={inputClass} type="date" value={form.submission_date} onChange={set('submission_date')} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Live Link</label>
                <input className={inputClass} type="url" value={form.live_link} onChange={set('live_link')} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input className={inputClass} value={form.username} onChange={set('username')} placeholder="@handle" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input className={inputClass} type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea className={`${inputClass} resize-none h-20`} value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
