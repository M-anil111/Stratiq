'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Pencil, Lock, X, Save, Loader2 } from 'lucide-react'

const PLATFORMS = [
  'Facebook Page',
  'Instagram',
  'Twitter / X',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'Pinterest',
  'Snapchat',
  'Google Business Profile',
  'Yelp',
  'Reddit',
  'Threads',
]

const ACCESS_LEVELS = ['owner', 'editor', 'analyst'] as const
const STATUSES = ['active', 'needs renewal', 'revoked'] as const

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  'needs renewal': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  revoked: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const selectClass =
  'w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

interface SocialAccount {
  id: string | null
  platform: string
  username: string | null
  password: string | null
  profile_url: string | null
  access_level: string | null
  status: string | null
}

interface EditForm {
  username: string
  password: string
  profile_url: string
  access_level: string
  status: string
}

const EMPTY_EDIT: EditForm = {
  username: '',
  password: '',
  profile_url: '',
  access_level: '',
  status: 'active',
}

export default function SocialAccountsTab({ projectId }: { projectId: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_EDIT)
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/social-accounts`)
      if (!res.ok) throw new Error('Failed to load social accounts')
      const data: SocialAccount[] = await res.json()
      // Merge with full platform list so all rows always show
      const map = new Map(data.map(a => [a.platform, a]))
      setAccounts(
        PLATFORMS.map(p =>
          map.get(p) ?? {
            id: null,
            platform: p,
            username: null,
            password: null,
            profile_url: null,
            access_level: null,
            status: null,
          }
        )
      )
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  function openEdit(account: SocialAccount) {
    setEditingPlatform(account.platform)
    setForm({
      username: account.username ?? '',
      password: account.password ?? '',
      profile_url: account.profile_url ?? '',
      access_level: account.access_level ?? '',
      status: account.status ?? 'active',
    })
    setShowFormPassword(false)
    setError(null)
  }

  function closeModal() {
    setEditingPlatform(null)
    setForm(EMPTY_EDIT)
    setError(null)
  }

  async function handleSave() {
    if (!editingPlatform) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/social-accounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: editingPlatform, ...form }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
      const updated: SocialAccount = await res.json()
      setAccounts(prev => prev.map(a => a.platform === updated.platform ? updated : a))
      closeModal()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function toggleReveal(platform: string) {
    setRevealed(prev => {
      const next = new Set(prev)
      next.has(platform) ? next.delete(platform) : next.add(platform)
      return next
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Passwords are AES-256-GCM encrypted
          </span>
        </div>
      </div>

      {error && !editingPlatform && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading social accounts…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Platform</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Handle</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Password</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Access Level</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Status</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Profile URL</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => (
                <tr key={account.platform} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3 text-white font-medium">{account.platform}</td>
                  <td className="px-3 py-3 text-slate-300 font-mono text-xs">
                    {account.username || <span className="text-slate-600 italic">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {account.password ? (
                      <div className="flex items-center gap-2">
                        <span className={revealed.has(account.platform) ? 'text-emerald-400 font-mono text-sm' : 'text-slate-400 tracking-widest text-xs'}>
                          {revealed.has(account.platform) ? account.password : '••••••••'}
                        </span>
                        <button
                          onClick={() => toggleReveal(account.platform)}
                          className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                          title={revealed.has(account.platform) ? 'Hide' : 'Reveal'}
                        >
                          {revealed.has(account.platform) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs italic">not set</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs capitalize text-slate-300">
                    {account.access_level || <span className="text-slate-600 italic">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {account.status ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[account.status] ?? 'bg-white/[0.06] text-slate-400'}`}>
                        {account.status}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs max-w-[160px] truncate">
                    {account.profile_url ? (
                      <a href={account.profile_url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline truncate block">
                        {account.profile_url}
                      </a>
                    ) : (
                      <span className="text-slate-600 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openEdit(account)}
                        className="p-1.5 rounded hover:bg-white/[0.08] text-slate-400 hover:text-sky-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">{editingPlatform}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Update account details</p>
              </div>
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
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Username / Handle</label>
                <input
                  className="input-glass w-full"
                  placeholder="@username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password / Token</label>
                <div className="relative">
                  <input
                    className="input-glass w-full pr-10"
                    type={showFormPassword ? 'text' : 'password'}
                    placeholder="Enter password or access token"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Access Level</label>
                  <select
                    className={selectClass}
                    value={form.access_level}
                    onChange={e => setForm(f => ({ ...f, access_level: e.target.value }))}
                  >
                    <option value="">— not set —</option>
                    {ACCESS_LEVELS.map(l => (
                      <option key={l} value={l} className="capitalize">{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                  <select
                    className={selectClass}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Account URL</label>
                <input
                  className="input-glass w-full"
                  type="url"
                  placeholder="https://..."
                  value={form.profile_url}
                  onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))}
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
