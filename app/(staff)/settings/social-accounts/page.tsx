'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Share2, Plus, Trash2, Loader2, CheckCircle, AlertCircle, X, Info,
} from 'lucide-react'

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'x' | 'youtube'

type PlatformMeta = {
  platform: Platform
  label: string
  brandColor: string
  envClientId: string
}

// Mirror of lib/social-oauth.ts PLATFORMS (labels/colors/env names) so the
// client can render brand cards without shipping any secrets.
const PLATFORMS: PlatformMeta[] = [
  { platform: 'facebook', label: 'Facebook', brandColor: '#1877F2', envClientId: 'FACEBOOK_APP_ID' },
  { platform: 'instagram', label: 'Instagram', brandColor: '#E4405F', envClientId: 'INSTAGRAM_APP_ID' },
  { platform: 'linkedin', label: 'LinkedIn', brandColor: '#0A66C2', envClientId: 'LINKEDIN_CLIENT_ID' },
  { platform: 'tiktok', label: 'TikTok', brandColor: '#111111', envClientId: 'TIKTOK_CLIENT_KEY' },
  { platform: 'x', label: 'X (Twitter)', brandColor: '#111111', envClientId: 'X_CLIENT_ID' },
  { platform: 'youtube', label: 'YouTube', brandColor: '#FF0000', envClientId: 'YOUTUBE_CLIENT_ID' },
]

const LABELS: Record<Platform, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.platform, p.label])
) as Record<Platform, string>

type Account = {
  id: string
  platform: Platform
  account_name: string | null
  account_handle: string | null
  external_id: string | null
  status: string | null
  token_expires_at: string | null
  created_at: string
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function Badge({ platform }: { platform: Platform }) {
  const meta = PLATFORMS.find((p) => p.platform === platform)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: meta?.brandColor || '#334155' }}
    >
      {meta?.label || platform}
    </span>
  )
}

function SocialAccountsInner() {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [manualFor, setManualFor] = useState<Platform | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualHandle, setManualHandle] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/social-accounts')
      const data = await res.json()
      if (data?.__unavailable) {
        setUnavailable(true)
        setAccounts([])
      } else if (Array.isArray(data)) {
        setAccounts(data)
        setUnavailable(false)
      }
    } catch {
      setBanner({ type: 'error', msg: 'Failed to load social accounts.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Success / error banners from OAuth redirects.
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const platform = searchParams.get('platform') as Platform | null
    if (connected) {
      setBanner({ type: 'success', msg: `${LABELS[connected as Platform] || connected} connected successfully.` })
    } else if (error === 'not_configured' && platform) {
      setBanner({
        type: 'error',
        msg: `${LABELS[platform] || platform} isn't configured yet. Add its app credentials, or record the account manually below.`,
      })
    } else if (error) {
      setBanner({ type: 'error', msg: `Connection failed${platform ? ` for ${LABELS[platform] || platform}` : ''}. Please try again.` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manualFor || !manualName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/social-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: manualFor,
          account_name: manualName.trim(),
          account_handle: manualHandle.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to add account')
      setBanner({ type: 'success', msg: `${LABELS[manualFor]} account recorded.` })
      setManualFor(null)
      setManualName('')
      setManualHandle('')
      await load()
    } catch (err: any) {
      setBanner({ type: 'error', msg: err.message || 'Failed to add account' })
    } finally {
      setSaving(false)
    }
  }

  async function disconnect(acc: Account) {
    if (!confirm(`Disconnect ${LABELS[acc.platform]} account "${acc.account_name || acc.account_handle || acc.platform}"?`)) return
    setDeletingId(acc.id)
    try {
      const res = await fetch(`/api/social-accounts/${acc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to disconnect')
      }
      setBanner({ type: 'success', msg: 'Account disconnected.' })
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id))
    } catch (err: any) {
      setBanner({ type: 'error', msg: err.message || 'Failed to disconnect' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-1">
        <Share2 className="h-6 w-6 text-sky-400 shrink-0" />
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Social Accounts</h1>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        Connect the accounts your team publishes from. Publishing and scheduling use these
        connected accounts &mdash; each platform activates once its app credentials are configured.
      </p>

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 mb-6 text-sm ${
            banner.type === 'success'
              ? 'bg-green-500/10 text-green-300 border border-green-500/20'
              : 'bg-red-500/10 text-red-300 border border-red-500/20'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="text-current/70 hover:text-current">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Connect accounts */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Connect an account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((p) => (
            <div key={p.platform} className="glass-card rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: p.brandColor }}
                >
                  {p.label.charAt(0)}
                </span>
                <span className="font-medium text-white">{p.label}</span>
              </div>
              <a
                href={`/api/auth/social/${p.platform}/connect`}
                className="btn-brand text-center text-sm py-2 rounded-xl font-medium"
              >
                Connect
              </a>
              <button
                type="button"
                onClick={() => { setManualFor(p.platform); setManualName(''); setManualHandle('') }}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add manually
              </button>
              <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                Requires {p.label} app credentials &mdash; set {p.envClientId} in your environment.
                If not configured, use &ldquo;Add manually&rdquo; to record the account.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Manual add form */}
      {manualFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setManualFor(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitManual}
            className="glass-card rounded-2xl p-5 w-full max-w-md flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Add {LABELS[manualFor]} account</h3>
              <button type="button" onClick={() => setManualFor(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Account name</label>
              <input
                autoFocus
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Acme Marketing"
                className="input-glass w-full px-3 py-2 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Handle (optional)</label>
              <input
                value={manualHandle}
                onChange={(e) => setManualHandle(e.target.value)}
                placeholder="@acme"
                className="input-glass w-full px-3 py-2 rounded-xl text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setManualFor(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-white/[0.06]">
                Cancel
              </button>
              <button type="submit" disabled={saving || !manualName.trim()} className="btn-brand px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connected accounts */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Connected accounts</h2>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : unavailable ? (
          <div className="glass-card rounded-2xl p-6 text-center text-sm text-slate-400">
            Social accounts aren&rsquo;t available yet. Apply migration 039 to enable this feature.
          </div>
        ) : accounts.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Share2 className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No accounts connected yet. Connect one above to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge platform={acc.platform} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {acc.account_name || acc.account_handle || 'Account'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {acc.account_handle ? `${acc.account_handle} · ` : ''}
                      {acc.status === 'manual' ? 'Manual record' : 'Connected'} · {fmtDate(acc.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disconnect(acc)}
                  disabled={deletingId === acc.id}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
                >
                  {deletingId === acc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function SocialAccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>}>
      <SocialAccountsInner />
    </Suspense>
  )
}
