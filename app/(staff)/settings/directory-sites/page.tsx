'use client'
import { useState, useEffect } from 'react'
import { Pencil, Trash2, Plus, X, Check, Globe } from 'lucide-react'

const CATEGORIES = [
  'Classified',
  'Business Listing',
  'Social Bookmarking',
  'Profile Creation',
  'Blog',
  'Directory',
]

const selectClass = "w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

interface Site {
  id: string
  url: string
  domain: string
  category: string
  da_score: number | null
}

interface FormState {
  url: string
  category: string
  da_score: string
}

const emptyForm = (): FormState => ({ url: '', category: CATEGORIES[0], da_score: '' })

export default function DirectorySitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // inline edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())

  const fetchSites = async () => {
    const res = await fetch('/api/settings/directory-sites')
    const data = await res.json()
    setSites(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchSites() }, [])

  const openModal = () => { setForm(emptyForm()); setError(''); setShowModal(true) }

  const handleAdd = async () => {
    if (!form.url.trim()) { setError('URL is required'); return }
    setSaving(true)
    const res = await fetch('/api/settings/directory-sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: form.url.trim(), category: form.category, da_score: form.da_score ? Number(form.da_score) : null }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to add site'); return }
    setShowModal(false)
    fetchSites()
  }

  const startEdit = (site: Site) => {
    setEditId(site.id)
    setEditForm({ url: site.url, category: site.category, da_score: site.da_score != null ? String(site.da_score) : '' })
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    const res = await fetch(`/api/settings/directory-sites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: editForm.url.trim(), category: editForm.category, da_score: editForm.da_score ? Number(editForm.da_score) : null }),
    })
    setSaving(false)
    if (!res.ok) return
    setEditId(null)
    fetchSites()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this site?')) return
    await fetch(`/api/settings/directory-sites/${id}`, { method: 'DELETE' })
    setSites(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Directory Sites</h1>
          <p className="text-slate-400 text-sm mt-1">Manage websites used in off-page submission dropdowns</p>
        </div>
        <button onClick={openModal} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="h-4 w-4" /> Add Site
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        ) : sites.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-300">No directory sites yet</p>
            <p className="text-sm mt-1">Add your first site to populate the off-page dropdown</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.05] border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Site URL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-24">DA Score</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site, i) => (
                  <tr key={site.id} className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    {editId === site.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.url}
                            onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                            className="input-glass text-xs py-1.5"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className={selectClass + ' py-1.5 text-xs'}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0} max={100}
                            value={editForm.da_score}
                            onChange={e => setEditForm(f => ({ ...f, da_score: e.target.value }))}
                            placeholder="—"
                            className="input-glass text-xs py-1.5 w-16"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => saveEdit(site.id)} disabled={saving} className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10 transition-colors">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] transition-colors">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-white font-mono text-xs">{site.url}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                            {site.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{site.da_score ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(site)} className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(site.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Directory Site</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Site URL</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={selectClass}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">DA Score <span className="text-slate-500">(optional, 0–100)</span></label>
                <input
                  type="number"
                  min={0} max={100}
                  placeholder="e.g. 45"
                  value={form.da_score}
                  onChange={e => setForm(f => ({ ...f, da_score: e.target.value }))}
                  className="input-glass"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] transition-all text-sm">
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={saving} className="flex-1 btn-brand py-2.5 text-sm disabled:opacity-60">
                  {saving ? 'Adding...' : 'Add Site'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
