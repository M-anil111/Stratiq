'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, FolderKanban, Check, Link2, AlertTriangle, RefreshCw } from 'lucide-react'

type LinkedRef = { id: string; name: string; type: 'client' | 'project'; linkedById: boolean; clientId?: string }
type SyncItem = {
  proofhubProjectId: number
  name: string
  description: string
  linked: LinkedRef[]
  nameHints: LinkedRef[]
}
type ClientOpt = { id: string; name: string; proofhubProjectId: string | null }

// "Sync / link projects" panel: lists every ProofHub project with its current
// Stratiq link and a control to link it to a client. Rate-limit safe (one
// /projects fetch server-side; local DB for the rest).
export default function SyncProjects() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<SyncItem[]>([])
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [pending, setPending] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proofhub/sync-projects')
      const j = await res.json()
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to load')
      if (j.configured === false) { setError('ProofHub is not configured.'); setItems([]); return }
      setItems(Array.isArray(j.items) ? j.items : [])
      setClients(Array.isArray(j.clients) ? j.clients : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveLink(item: SyncItem) {
    const clientId = pending[item.proofhubProjectId]
    if (!clientId) return
    setSavingId(item.proofhubProjectId)
    setError(null)
    try {
      const res = await fetch('/api/proofhub/sync-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'client', targetId: clientId, proofhubProjectId: item.proofhubProjectId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to link')
      setSavedId(item.proofhubProjectId)
      setTimeout(() => setSavedId(null), 2000)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to link')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Map each ProofHub project to a Stratiq client. Already-linked projects show a badge.
        </p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {items.length === 0 && !error && <p className="text-sm text-slate-500">No ProofHub projects found.</p>}

      <div className="space-y-2">
        {items.map((item) => {
          const isLinked = item.linked.length > 0
          return (
            <div key={item.proofhubProjectId} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FolderKanban className="h-4 w-4 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                  {isLinked ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Linked to {item.linked.map((l) => l.name).join(', ')}
                    </p>
                  ) : item.nameHints.length > 0 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">Name matches: {item.nameHints.map((h) => h.name).join(', ')}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Not linked</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={pending[item.proofhubProjectId] ?? (item.linked.find((l) => l.type === 'client')?.id || '')}
                  onChange={(e) => setPending((p) => ({ ...p, [item.proofhubProjectId]: e.target.value }))}
                  className="input-glass text-sm py-1.5 max-w-[220px]"
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => saveLink(item)}
                  disabled={savingId === item.proofhubProjectId || !pending[item.proofhubProjectId]}
                  className="btn-brand rounded-lg px-3 py-1.5 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingId === item.proofhubProjectId ? <Loader2 className="h-4 w-4 animate-spin" />
                    : savedId === item.proofhubProjectId ? <Check className="h-4 w-4" />
                    : <Link2 className="h-4 w-4" />}
                  Link
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
