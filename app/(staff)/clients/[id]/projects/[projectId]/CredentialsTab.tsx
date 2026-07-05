'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Eye, EyeOff, Pencil, Trash2, Lock, X, Save, Loader2 } from 'lucide-react'

interface Credential {
  id: string
  site_name: string
  username: string
  has_password: boolean
  created_at: string
}

interface CredentialForm {
  site_name: string
  username: string
  password: string
}

const EMPTY_FORM: CredentialForm = { site_name: '', username: '', password: '' }

export default function CredentialsTab({ projectId }: { projectId: string }) {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  // Map of credId -> decrypted password string (fetched on demand)
  const [revealed, setRevealed] = useState<Record<string, string | null>>({})
  const [revealing, setRevealing] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CredentialForm>(EMPTY_FORM)
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCredentials = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/credentials`)
      if (!res.ok) throw new Error('Failed to load credentials')
      setCredentials(await res.json())
      setRevealed({})
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchCredentials() }, [fetchCredentials])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowFormPassword(false)
    setShowModal(true)
  }

  function openEdit(cred: Credential) {
    setEditingId(cred.id)
    setForm({ site_name: cred.site_name, username: cred.username, password: '' })
    setShowFormPassword(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSave() {
    if (!form.site_name.trim() || !form.username.trim()) {
      setError('Site name and username are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url = editingId
        ? `/api/projects/${projectId}/credentials/${editingId}`
        : `/api/projects/${projectId}/credentials`
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
      await fetchCredentials()
      closeModal()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/projects/${projectId}/credentials/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setCredentials(prev => prev.filter(c => c.id !== id))
      setConfirmDeleteId(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  async function toggleReveal(id: string) {
    if (id in revealed) {
      // Hide — remove from revealed map
      setRevealed(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    // Fetch decrypted password on demand
    setRevealing(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/projects/${projectId}/credentials/${id}/decrypt`, { method: 'POST' })
      if (!res.ok) throw new Error('Could not decrypt')
      const { password } = await res.json()
      setRevealed(prev => ({ ...prev, [id]: password }))
    } catch {
      setError('Failed to reveal password.')
    } finally {
      setRevealing(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AES-256-GCM Encrypted
          </span>
        </div>
        <button
          onClick={openAdd}
          className="btn-brand flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Credential
        </button>
      </div>

      {/* Error banner */}
      {error && !showModal && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading credentials…
        </div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Lock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No credentials yet</p>
          <p className="text-sm mt-1">Click "Add Credential" to store login details for this project.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Site Name</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Username</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Password</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map(cred => {
                const isRevealed = cred.id in revealed
                const isRevealing = revealing.has(cred.id)
                return (
                  <tr key={cred.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3 text-white font-medium">{cred.site_name}</td>
                    <td className="px-3 py-3 text-slate-300 font-mono text-xs">{cred.username}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {cred.has_password ? (
                          <>
                            <span className={isRevealed ? 'text-emerald-400 font-mono text-sm' : 'text-slate-400 tracking-widest text-xs'}>
                              {isRevealed ? revealed[cred.id] : '••••••••'}
                            </span>
                            <button
                              onClick={() => toggleReveal(cred.id)}
                              disabled={isRevealing}
                              className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                              title={isRevealed ? 'Hide' : 'Reveal'}
                            >
                              {isRevealing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isRevealed ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-600 text-xs italic">not set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {confirmDeleteId === cred.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-400">Delete?</span>
                            <button
                              onClick={() => handleDelete(cred.id)}
                              disabled={deletingId === cred.id}
                              className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-colors disabled:opacity-50"
                            >
                              {deletingId === cred.id ? 'Deleting…' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded text-xs text-slate-400 hover:bg-white/[0.06] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(cred)}
                              className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-sky-400 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(cred.id)}
                              className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">
                {editingId ? 'Edit Credential' : 'Add Credential'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Site Name <span className="text-red-400">*</span></label>
                <input
                  className="input-glass w-full"
                  placeholder="e.g. WordPress Admin, Google Ads"
                  value={form.site_name}
                  onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Username / Email <span className="text-red-400">*</span></label>
                <input
                  className="input-glass w-full"
                  placeholder="username or email"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Password {editingId && <span className="text-slate-500">(leave blank to keep existing)</span>}
                </label>
                <div className="relative">
                  <input
                    className="input-glass w-full pr-10"
                    type={showFormPassword ? 'text' : 'password'}
                    placeholder={editingId ? 'Enter new password or leave blank' : 'Enter password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Lock className="h-3 w-3 text-emerald-400" />
                  <span className="text-xs text-emerald-400/70">Stored with AES-256-GCM encryption</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/[0.06] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-brand flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
