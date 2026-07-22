'use client'
import { useState } from 'react'
import { Database, Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'

export default function DatabaseSettingsPage() {
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; version?: string } | null>(null)
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const apply = async () => {
    setApplying(true)
    setResult(null)
    setError(null)
    setForbidden(false)
    try {
      const res = await fetch('/api/admin/apply-migrations', { method: 'POST' })
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      const data = await res.json()
      if (res.ok && data.ok) {
        setResult({ ok: true, version: data.version })
      } else {
        setError({ code: data.error, message: data.message || data.error || 'Failed to apply updates' })
      }
    } catch {
      setError({ message: 'Network error — please try again.' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
            <Database className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Database Updates</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Apply pending schema updates (migrations 010–051)</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
          This applies all pending database schema updates directly to your database. The updates are
          idempotent — every statement uses <code className="text-slate-800 dark:text-slate-200">IF NOT EXISTS</code> or an
          equivalent guard, so nothing is duplicated or destroyed.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          It is completely safe to run this multiple times. If the schema is already up to date, running
          it again has no effect.
        </p>

        {forbidden && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">Admins only. You do not have permission to apply database updates.</div>
          </div>
        )}

        {result?.ok && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-200">
              Database updates applied successfully. Current version: <strong>{result.version}</strong>.
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 mb-4">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-200">
              {error.code === 'no_connection_string' ? (
                <>
                  <p className="font-medium mb-1">No database connection string configured.</p>
                  <p>
                    Add <code className="text-rose-100">POSTGRES_URL_NON_POOLING</code> (or{' '}
                    <code className="text-rose-100">DATABASE_URL</code>) in your Vercel environment
                    variables — the Supabase integration usually sets it.
                  </p>
                </>
              ) : (
                <p>{error.message}</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={apply}
          disabled={applying}
          className="btn-brand inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
        >
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {applying ? 'Applying updates…' : 'Apply database updates'}
        </button>
      </div>
    </div>
  )
}
