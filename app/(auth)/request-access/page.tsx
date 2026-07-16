'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import Turnstile from '@/components/Turnstile'

export default function RequestAccessPage() {
  const [form, setForm] = useState({ name: '', email: '', role: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken }),
      })
      if (res.ok) setSent(true)
      else setError('Failed to send request. Please email your admin directly.')
    } catch {
      setError('Something went wrong. Please try again.')
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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Request sent!</h2>
              <p className="text-slate-400 text-sm mb-6">
                Your admin has been notified. You'll receive an invite email once your account is created.
              </p>
              <Link href="/login" className="text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Request access</h2>
              <p className="text-slate-400 text-sm mb-8">Fill out the form and your admin will create your account.</p>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Full name <span className="text-red-400">*</span></label>
                  <input type="text" required className="input-glass" placeholder="Jane Smith"
                    value={form.name} onChange={set('name')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Work email <span className="text-red-400">*</span></label>
                  <input type="email" required className="input-glass" placeholder="jane@mindshare.co"
                    value={form.email} onChange={set('email')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Your role</label>
                  <select className="w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    value={form.role} onChange={set('role')}>
                    <option value="">Select role…</option>
                    <option value="SEO Specialist">SEO Specialist</option>
                    <option value="PPC Manager">PPC Manager</option>
                    <option value="Social Media Manager">Social Media Manager</option>
                    <option value="Account Manager">Account Manager</option>
                    <option value="Content Writer">Content Writer</option>
                    <option value="Designer">Designer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Message <span className="text-slate-600">(optional)</span></label>
                  <textarea className="input-glass resize-none h-20" placeholder="Anything you'd like to add…"
                    value={form.message} onChange={set('message')} />
                </div>
                <Turnstile onVerify={setTurnstileToken} />

                <button type="submit"
                  disabled={loading || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)}
                  className="btn-brand w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Sending…' : 'Send request'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
