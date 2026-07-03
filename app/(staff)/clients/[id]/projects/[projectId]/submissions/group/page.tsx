'use client'
import { useState } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'

const PLATFORMS = [
  'Facebook Group', 'LinkedIn Group', 'Reddit', 'Nextdoor',
  'Discord', 'Telegram', 'WhatsApp', 'Other',
]
const POST_TYPES = ['Text', 'Image', 'Video', 'Link Share', 'Event Promo', 'Poll']
const STATUSES = ['Live', 'Under Review', 'Deleted', 'Pending Approval']

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

const statusColors: Record<string, string> = {
  live: 'bg-green-100 text-green-800',
  under_review: 'bg-amber-100 text-amber-800',
  deleted: 'bg-red-100 text-red-800',
  pending_approval: 'bg-blue-100 text-blue-800',
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
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/group-postings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: form.status.toLowerCase().replace(/ /g, '_') }),
      })
      if (res.ok) {
        const data = await res.json()
        setEntries(p => [data, ...p])
        setShowForm(false)
        setForm(emptyForm())
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Group Postings ({entries.length})</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Group Post
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-medium">No group postings yet</p>
            <p className="text-sm mt-1">Click "Add Group Post" to log your first group posting</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Platform', 'Group Name', 'Post Type', 'Status', 'Live Link', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{entry.platform}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate">{entry.group_name}</td>
                    <td className="px-4 py-3 capitalize">{entry.post_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status] || ''}`}>
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.live_link && (
                        <a href={entry.live_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-600 hover:text-sky-700">
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{entry.submission_date}</td>
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

        <div className="p-4 border-t border-gray-100 flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-colors">
            <Send className="h-3.5 w-3.5" /> Send to All
          </button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to DM Manager</button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to Sales Manager</button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to Client</button>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">Add Group Posting</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post Type <span className="text-red-500">*</span></label>
                  <select className={selectClass} value={form.post_type} onChange={set('post_type')} required>
                    {POST_TYPES.map(t => <option key={t} value={t.toLowerCase().replace(' ', '_')}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name <span className="text-red-500">*</span></label>
                <input className={inputClass} value={form.group_name} onChange={set('group_name')} placeholder="Group or community name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group URL</label>
                <input className={inputClass} type="url" value={form.group_url} onChange={set('group_url')} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Post Content <span className="text-red-500">*</span></label>
                <textarea className={`${inputClass} resize-none h-24`} value={form.post_content} onChange={set('post_content')} placeholder="What was posted..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Live Link</label>
                <input className={inputClass} type="url" value={form.live_link} onChange={set('live_link')} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUSES.map(s => <option key={s} value={s.toLowerCase().replace(/ /g, '_')}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date <span className="text-red-500">*</span></label>
                  <input className={inputClass} type="date" value={form.submission_date} onChange={set('submission_date')} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input className={inputClass} value={form.username} onChange={set('username')} placeholder="Username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input className={inputClass} type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member Count</label>
                <input className={inputClass} type="number" value={form.member_count} onChange={set('member_count')} placeholder="e.g. 5000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea className={`${inputClass} resize-none h-16`} value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
