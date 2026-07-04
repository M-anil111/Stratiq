'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Save, Loader2, BarChart2 } from 'lucide-react'

const TOOL_OPTIONS = [
  'Google Analytics',
  'Google Tag Manager',
  'Google Search Console',
  'Google Ads',
  'Google Business Profile',
  'Facebook Pixel',
  'Facebook Business Manager',
  'HubSpot',
  'Other',
]

const selectClass =
  'w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

interface TrackingTool {
  id: string
  tool_name: string
  profile_id: string | null
  account_email: string | null
  created_at: string
}

interface ToolForm {
  tool_name: string
  profile_id: string
  account_email: string
}

const EMPTY_FORM: ToolForm = { tool_name: TOOL_OPTIONS[0], profile_id: '', account_email: '' }

export default function TrackingToolsTab({ projectId }: { projectId: string }) {
  const [tools, setTools] = useState<TrackingTool[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ToolForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchTools = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tracking-tools`)
      if (!res.ok) throw new Error('Failed to load tracking tools')
      setTools(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchTools() }, [fetchTools])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
    setError(null)
  }

  function openEdit(tool: TrackingTool) {
    setEditingId(tool.id)
    setForm({
      tool_name: tool.tool_name,
      profile_id: tool.profile_id ?? '',
      account_email: tool.account_email ?? '',
    })
    setShowModal(true)
    setError(null)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSave() {
    if (!form.tool_name.trim()) {
      setError('Tool name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url = editingId
        ? `/api/projects/${projectId}/tracking-tools/${editingId}`
        : `/api/projects/${projectId}/tracking-tools`
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
      await fetchTools()
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
      const res = await fetch(`/api/projects/${projectId}/tracking-tools/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setTools(prev => prev.filter(t => t.id !== id))
      setConfirmDeleteId(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-medium text-slate-300">Tracking Tools</h3>
        <button onClick={openAdd} className="btn-brand flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Tool
        </button>
      </div>

      {error && !showModal && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tracking tools…
        </div>
      ) : tools.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <BarChart2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No tracking tools yet</p>
          <p className="text-sm mt-1">Click "Add Tool" to link a tracking or analytics tool to this project.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Tool Name</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Profile / Property ID</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Account Email</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map(tool => (
                <tr key={tool.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3 text-white font-medium">{tool.tool_name}</td>
                  <td className="px-3 py-3 text-slate-300 font-mono text-xs">{tool.profile_id || <span className="text-slate-600 italic">—</span>}</td>
                  <td className="px-3 py-3 text-slate-300 text-xs">{tool.account_email || <span className="text-slate-600 italic">—</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {confirmDeleteId === tool.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            onClick={() => handleDelete(tool.id)}
                            disabled={deletingId === tool.id}
                            className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {deletingId === tool.id ? 'Deleting…' : 'Yes, delete'}
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
                            onClick={() => openEdit(tool)}
                            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-sky-400 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(tool.id)}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">
                {editingId ? 'Edit Tracking Tool' : 'Add Tracking Tool'}
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
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Tool Name <span className="text-red-400">*</span>
                </label>
                <select
                  className={selectClass}
                  value={form.tool_name}
                  onChange={e => setForm(f => ({ ...f, tool_name: e.target.value }))}
                >
                  {TOOL_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Profile / Property ID</label>
                <input
                  className="input-glass w-full"
                  placeholder="e.g. UA-123456789 or G-XXXXXXXXXX"
                  value={form.profile_id}
                  onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Email</label>
                <input
                  className="input-glass w-full"
                  type="email"
                  placeholder="account@example.com"
                  value={form.account_email}
                  onChange={e => setForm(f => ({ ...f, account_email: e.target.value }))}
                />
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
