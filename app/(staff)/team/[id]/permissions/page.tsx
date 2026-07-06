'use client'

// The Access editor — HubSpot-style granular per-user permissions.
// Expandable resource sections with view/create/edit/delete toggles,
// role-default presets, and a permission-change history panel.
// Broader per-tool enforcement and compare-access are future work.

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronDown, ChevronRight, Check, Loader2, ShieldCheck, ArrowLeft, History,
} from 'lucide-react'
import { effectivePermissions, type Action, type PermissionMap } from '@/lib/permissions'

interface Resource { key: string; label: string; actions: Action[] }

const ACTION_LABELS: Record<Action, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
}

const ROLE_PRESETS = ['super_admin', 'admin', 'manager', 'team_member', 'billing_admin', 'client']

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer ${checked ? 'bg-sky-500' : 'bg-slate-700'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

interface HistoryEntry {
  id: string
  action: string
  user_email: string | null
  resource_id: string | null
  created_at: string
}

export default function UserAccessPage() {
  const params = useParams()
  const userId = String(params.id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const [targetUser, setTargetUser] = useState<{ full_name?: string; email?: string; role?: string } | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [perms, setPerms] = useState<PermissionMap>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [presetRole, setPresetRole] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/team/${userId}/permissions`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: any) => {
        if (cancelled) return
        setTargetUser(data.user || { role: data.role })
        setResources(data.resources || [])
        setPerms(data.effective || {})
        setPresetRole(data.role || '')
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setLoading(false); showToast('err', 'Failed to load access settings') } })

    fetch(`/api/audit-log?resource_type=user&action=permissions_changed&limit=100`)
      .then(r => r.ok ? r.json() : { entries: [] })
      .then((d: any) => {
        if (cancelled) return
        const rows = (d.entries || []).filter((e: HistoryEntry) => e.resource_id === userId)
        setHistory(rows)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userId, showToast])

  const setAction = (res: string, action: Action, val: boolean) => {
    setPerms(p => ({ ...p, [res]: { ...(p[res] || {}), [action]: val } }))
  }

  const selectAllSection = (res: Resource, val: boolean) => {
    setPerms(p => {
      const next = { ...(p[res.key] || {}) }
      for (const a of res.actions) next[a] = val
      return { ...p, [res.key]: next }
    })
  }

  const turnOffAll = () => {
    setPerms(() => {
      const next: PermissionMap = {}
      for (const r of resources) {
        next[r.key] = {}
        for (const a of r.actions) next[r.key][a] = false
      }
      return next
    })
  }

  // Load a role's defaults as a starting point. Computed on the client from
  // the shared permissions module (no stored overrides), so the toggles snap
  // to that role's baseline which the admin can then tweak before saving.
  const applyRoleDefaults = (role: string) => {
    if (!role) return
    setPresetRole(role)
    setPerms(effectivePermissions(role, null))
    showToast('ok', `Applied ${role.replace('_', ' ')} defaults`)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/team/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      })
      if (res.ok) {
        showToast('ok', 'Access saved')
      } else {
        const d = await res.json().catch(() => ({}))
        showToast('err', d.error || 'Failed to save')
      }
    } catch {
      showToast('err', 'Failed to save')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="h-8 w-48 rounded bg-slate-800 animate-pulse" />
        <div className="h-20 rounded-lg bg-slate-800 animate-pulse" />
        {[0, 1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : null}
          {toast.msg}
        </div>
      )}

      <Link href="/team" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to team
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 shrink-0 text-sky-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              {targetUser?.full_name || targetUser?.email || 'User'} — Access
            </h1>
            <p className="text-sm text-slate-400">
              Role: <span className="capitalize">{(targetUser?.role || '').replace('_', ' ') || 'unknown'}</span>
            </p>
          </div>
        </div>
        <button
          onClick={save} disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save access
        </button>
      </div>

      {/* Preset + bulk controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Apply role defaults</label>
          <select
            value={presetRole}
            onChange={e => applyRoleDefaults((e.target as HTMLSelectElement).value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Pick a role…</option>
            {ROLE_PRESETS.map(r => (
              <option key={r} value={r} className="capitalize">{r.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <button onClick={turnOffAll} className="self-start text-sm text-slate-400 hover:text-red-400 sm:self-auto">
          Turn off all
        </button>
      </div>

      {/* Resource sections */}
      <div className="space-y-2">
        {resources.map(res => {
          const isOpen = expanded[res.key]
          const rperm = perms[res.key] || {}
          const allOn = res.actions.every(a => rperm[a])
          return (
            <div key={res.key} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50">
              <button
                onClick={() => setExpanded(e => ({ ...e, [res.key]: !e[res.key] }))}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 font-medium text-slate-100">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {res.label}
                </span>
                <span className="text-xs text-slate-500">
                  {res.actions.filter(a => rperm[a]).length}/{res.actions.length}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-800 px-4 py-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Permissions</span>
                    <button
                      onClick={() => selectAllSection(res, !allOn)}
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      {allOn ? 'Clear section' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {res.actions.map(a => (
                      <div key={a} className="flex items-center justify-between rounded-md bg-slate-800/40 px-3 py-2">
                        <span className="text-sm text-slate-300">{ACTION_LABELS[a]}</span>
                        <Toggle checked={!!rperm[a]} onChange={v => setAction(res.key, a, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Permission history */}
      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <History className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-100">Permission history</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No permission changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {history.map(h => (
              <li key={h.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-300">
                  Changed by <span className="font-medium text-slate-100">{h.user_email || 'unknown'}</span>
                </span>
                <span className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
