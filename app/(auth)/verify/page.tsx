'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

const SUPPORT_EMAIL = 'support@stratiqnow.com'

export default function VerifyPage() {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [maskedEmail, setMaskedEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const sendCode = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/auth/otp', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (data?.unavailable) {
        // OTP layer unavailable (e.g. migration not applied) — don't trap the user.
        router.push('/dashboard')
        return
      }
      if (data?.email) setMaskedEmail(data.email)
    } catch {
      // Network error — fail open.
      router.push('/dashboard')
    }
  }, [router])

  useEffect(() => {
    sendCode()
  }, [sendCode])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, '')
    if (!v) {
      setDigits(prev => { const n = [...prev]; n[i] = ''; return n })
      return
    }
    setDigits(prev => {
      const n = [...prev]
      // Support paste of full code.
      if (v.length > 1) {
        for (let k = 0; k < v.length && i + k < 6; k++) n[i + k] = v[k]
      } else {
        n[i] = v[0]
      }
      return n
    })
    const next = Math.min(5, i + v.length)
    inputsRef.current[next]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Incorrect code. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setCooldown(30)
    await sendCode()
  }

  const handleReturnToLogin = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    router.push('/login')
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
          <div className="w-14 h-14 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="h-7 w-7 text-sky-400" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 text-center">Enter the code to verify your identity.</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 text-center">
            We&apos;ve sent a code to {maskedEmail || 'your email'}.
          </p>

          <p className="text-center text-sm mb-6">
            <button type="button" onClick={handleReturnToLogin} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
              Not the right email? <span className="text-sky-400">Return to login</span>
            </button>
          </p>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600 dark:text-red-400 mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputsRef.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={i === 0 ? 6 : 1}
                  value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="input-glass w-12 h-14 text-center text-xl font-semibold px-0"
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            <p className="text-center text-xs text-slate-500 dark:text-slate-500">
              Need assistance with reactivating your account?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sky-400 hover:text-sky-300">Contact us</a>
            </p>

            <button type="submit" disabled={loading}
              className="btn-brand w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Verifying…' : 'Login'}
            </button>

            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Didn&apos;t receive a code?{' '}
              <button type="button" onClick={handleResend} disabled={cooldown > 0}
                className="text-sky-400 hover:text-sky-300 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed">
                {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
