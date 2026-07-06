'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Save, Loader2, BarChart2 } from 'lucide-react'

const TOOL_OPTIONS = [
  'Google Analytics 4',
  'Google Analytics (UA)',
  'Google Search Console',
  'Google Tag Manager',
  'Google Ads',
  'Google Business Profile',
  'Facebook Pixel',
  'Facebook Business Manager',
  'Hotjar',
  'Semrush',
  'Ahrefs',
  'Moz',
  'HubSpot',
  'Mailchimp',
  'ActiveCampaign',
  'Klaviyo',
  'Other',
]

const ACCESS_TYPES = ['view only', 'editor', 'owner'] as const

const selectClass =
  'w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

interface TrackingTool {
  id: string
  tool_name: string
  profile_id: string | null
  account_email: string | null
  access_type: string | null
  notes: string | null
  url: string | null
  created_at: string
}

interface ToolForm {
  tool_name: string
  profile_id: string
  account_email: string
  access_type: string
  notes: string
  url: string
}

const EMPTY_FORM: ToolForm = {
  tool_name: TOOL_OPTIONS[0],
  profile_id: '',
  account_email: '',
  access_type: '',
  notes: '',
  url: '',
}

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
      access_type: tool.access_type ?? '',
      notes: tool.notes ?? '',
      url: tool.url ?? '',
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
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Tracking &amp; Analytics Tools</h3>
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
          <p className="text-sm mt-1">Click &ldquo;Add Tool&rdquo; to link a tracking or analytics tool to this project.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-900/10 dark:border-white/[0.06]">
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Tool</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Property / Profile ID</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Account Email</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Access</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Notes / URL</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Date Added</th>
                <th className="text-right px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map(tool => (
                <tr key={tool.id} className="border-b border-slate-900/10 dark:border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3 text-slate-900 dark:text-white font-medium">{tool.tool_name}</td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">{tool.profile_id || <span className="text-slate-600 italic">—</span>}</td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300 text-xs">{tool.account_email || <span className="text-slate-600 italic">—</span>}</td>
                  <td className="px-3 py-3 text-xs capitalize text-slate-700 dark:text-slate-300">{tool.access_type || <span className="text-slate-600 italic">—</span>}</td>
                  <td className="px-3 py-3 text-xs max-w-[180px]">
                    {tool.url ? (
                      <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline block truncate">{tool.url}</a>
                    ) : tool.notes ? (
                      <span className="text-slate-600 dark:text-slate-400 truncate block">{tool.notes}</span>
                    ) : (
                      <span className="text-slate-600 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(tool.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
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
                            className="px-2 py-1 rounded text-xs text-slate-600 dark:text-slate-400 hover:bg-white/[0.06] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(tool)}
                            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-sky-400 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(tool.id)}
                            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-red-400 transition-colors"
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
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingId ? 'Edit Tracking Tool' : 'Add Tracking Tool'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-white transition-colors">
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Tool <span className="text-red-400">*</span>
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Property / Profile ID</label>
                <input
                  className="input-glass w-full"
                  placeholder="e.g. G-XXXXXXXXXX or UA-123456789"
                  value={form.profile_id}
                  onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Account Email</label>
                <input
                  className="input-glass w-full"
                  type="email"
                  placeholder="account@example.com"
                  value={form.account_email}
                  onChange={e => setForm(f => ({ ...f, account_email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Access Type</label>
                <select
                  className={selectClass}
                  value={form.access_type}
                  onChange={e => setForm(f => ({ ...f, access_type: e.target.value }))}
                >
                  <option value="">— not set —</option>
                  {ACCESS_TYPES.map(a => (
                    <option key={a} value={a} className="capitalize">{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">URL</label>
                <input
                  className="input-glass w-full"
                  type="url"
                  placeholder="https://..."
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
                <textarea
                  className="input-glass w-full resize-none"
                  rows={2}
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-white/[0.06] transition-colors">
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
