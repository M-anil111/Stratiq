'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
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
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Password updated!</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Taking you to the dashboard…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Set new password</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-8">Choose a strong password for your account.</p>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600 dark:text-red-400 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">New password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} required className="input-glass pr-10"
                      placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">Confirm password</label>
                  <input type="password" required className="input-glass" placeholder="Repeat password"
                    value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
                <button type="submit" disabled={loading}
                  className="btn-brand w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
