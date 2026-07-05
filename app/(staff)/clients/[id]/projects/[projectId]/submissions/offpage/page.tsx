'use client'
import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Edit2, Trash2, X, Loader2 } from 'lucide-react'

const STATUSES = ['pending', 'live', 'rejected']

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  live: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  rejected: 'bg-red-500/15 text-red-400 border border-red-500/25',
  under_review: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  deleted: 'bg-red-500/15 text-red-400 border border-red-500/25',
}

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const emptyForm = () => ({
  directory_site_id: '',
  directory_name: '',
  website_url: '',
  status: 'pending',
  submission_date: today(),
  comment: '',
})

export default function OffPagePage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [directorySites, setDirectorySites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    fetch(`/api/projects/${params.projectId}/offpage`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .finally(() => setLoading(false))

    fetch('/api/settings/directory-sites')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDirectorySites(data) })
  }, [params.projectId])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleDirectoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const site = directorySites.find(s => s.id === val)
    setForm(f => ({ ...f, directory_site_id: val, directory_name: site ? (site.domain || site.url) : '' }))
  }

  const openAdd = () => { setEditEntry(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (entry: any) => {
    setEditEntry(entry)
    setForm({
      directory_site_id: entry.directory_site_id || '',
      directory_name: entry.directory_name || '',
      website_url: entry.website_url || '',
      status: entry.status || 'pending',
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
      const payload = {
        directory_site_id: form.directory_site_id || null,
        directory_name: form.directory_name || null,
        website_url: form.website_url,
        status: form.status,
        submission_date: form.submission_date,
        comment: form.comment || null,
      }
      if (editEntry) {
        const res = await fetch(`/api/projects/${params.projectId}/offpage/${editEntry.id}`, {
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
        const res = await fetch(`/api/projects/${params.projectId}/offpage`, {
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
      const res = await fetch(`/api/projects/${params.projectId}/offpage/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setEntries(p => p.filter(x => x.id !== deleteId))
        setDeleteId(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  const displayDir = (entry: any) => entry.directory_name || directorySites.find((s: any) => s.id === entry.directory_site_id)?.domain || entry.website_url

  return (
    <div>
      <div className="glass-card">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">Directory Citations ({entries.length})</h2>
          <button onClick={openAdd} className="btn-brand flex items-center gap-2 px-3 py-1.5 text-sm font-medium">
            <Plus className="h-4 w-4" />
            Add Submission
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium">No submissions yet</p>
            <p className="text-sm mt-1">Click &quot;Add Submission&quot; to log your first directory citation</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['#', 'Directory', 'URL Submitted To', 'Status', 'Date Submitted', 'Notes', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">{displayDir(entry)}</td>
                    <td className="px-4 py-3">
                      {entry.website_url ? (
                        <a href={entry.website_url.startsWith('http') ? entry.website_url : `https://${entry.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300 max-w-[140px] truncate">
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />{entry.website_url}
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status] || ''}`}>
                        {entry.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{entry.submission_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">{entry.comment || '—'}</td>
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
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">{editEntry ? 'Edit Directory Submission' : 'Add Directory Submission'}</h3>
              <button onClick={closeModal}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Directory <span className="text-red-400">*</span></label>
                {directorySites.length > 0 ? (
                  <select className={selectClass} value={form.directory_site_id} onChange={handleDirectoryChange} required>
                    <option value="">Select directory...</option>
                    {directorySites.map((site: any) => (
                      <option key={site.id} value={site.id}>{site.domain || site.url}{site.category ? ` — ${site.category}` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input-glass" value={form.directory_name} onChange={set('directory_name')} placeholder="Directory name" required />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">URL Submitted To <span className="text-red-400">*</span></label>
                <input className="input-glass" value={form.website_url} onChange={set('website_url')} placeholder="https://example.com/submit" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status <span className="text-red-400">*</span></label>
                  <select className={selectClass} value={form.status} onChange={set('status')} required>
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date Submitted</label>
                  <input className="input-glass" type="date" value={form.submission_date} onChange={set('submission_date')} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea className="input-glass resize-none h-20" value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
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
