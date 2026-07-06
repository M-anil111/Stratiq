'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Loader2, AlertCircle, UserPlus, CheckCircle2 } from 'lucide-react'

function roleLabel(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function AcceptInviteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''

  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'unavailable' | 'done'>('loading')
  const [invite, setInvite] = useState<{ email: string; role: string; account_type: string } | null>(null)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/team/invite/accept?token=${encodeURIComponent(token)}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data?.unavailable) { setState('unavailable'); return }
        if (data?.valid) {
          setInvite({ email: data.email, role: data.role, account_type: data.account_type })
          setState('ready')
        } else {
          setState('invalid')
        }
      } catch {
        if (!cancelled) setState('invalid')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, full_name: fullName.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setState('done')
        setTimeout(() => router.push('/login'), 2500)
      } else {
        setError(data?.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
      <div className="orb w-[500px] h-[500px] bg-sky-500 top-[-100px] left-[-150px]" />
      <div className="orb w-[400px] h-[400px] bg-violet-600 bottom-[-80px] right-[-100px]" />

      <div className="w-full max-w-md animate-float-up">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-xl shadow-sky-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">Stratiq</span>
        </div>

        <div className="glass rounded-3xl p-8">
          {state === 'loading' && (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin mb-3" />
              <p className="text-sm">Checking your invitation…</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Invitation unavailable</h2>
              <p className="text-slate-400 text-sm mb-6">
                This invitation link is invalid, has expired, or has already been used. Please ask your administrator to send a new one.
              </p>
              <Link href="/login" className="text-sky-400 hover:text-sky-300 text-sm">Go to login</Link>
            </div>
          )}

          {state === 'unavailable' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Not quite ready</h2>
              <p className="text-slate-400 text-sm mb-6">
                This workspace isn&apos;t fully set up yet, so invitations can&apos;t be accepted right now. Please contact your administrator and try again shortly.
              </p>
              <Link href="/login" className="text-sky-400 hover:text-sky-300 text-sm">Go to login</Link>
            </div>
          )}

          {state === 'done' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You&apos;re all set!</h2>
              <p className="text-slate-400 text-sm mb-6">
                Your account has been created. Redirecting you to sign in…
              </p>
              <Link href="/login" className="text-sky-400 hover:text-sky-300 text-sm">Go to login now</Link>
            </div>
          )}

          {state === 'ready' && invite && (
            <>
              <div className="w-14 h-14 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mx-auto mb-5">
                <UserPlus className="h-7 w-7 text-sky-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1 text-center">Accept your invitation</h2>
              <p className="text-slate-400 text-sm mb-2 text-center">
                Set a password to finish creating your {invite.account_type === 'client' ? 'client' : 'team'} account.
              </p>
              <p className="text-slate-300 text-sm mb-6 text-center">
                <span className="font-medium">{invite.email}</span>
                <span className="text-slate-500"> · {roleLabel(invite.role)}</span>
              </p>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="input-glass w-full px-4 py-3 rounded-xl text-sm"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="input-glass w-full px-4 py-3 rounded-xl text-sm"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className="input-glass w-full px-4 py-3 rounded-xl text-sm"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button type="submit" disabled={submitting}
                  className="btn-brand w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Creating account…' : 'Accept & create account'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-400 mt-6">
                Already have an account? <Link href="/login" className="text-sky-400 hover:text-sky-300">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
      <AcceptInviteInner />
    </Suspense>
  )
}
