'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'

const features = [
  'Manage all clients and projects in one place',
  'Track monthly activity targets automatically',
  'Pull Google Ads and Meta Ads data in real time',
  'Client portal with reports and file sharing',
]

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="min-h-screen bg-mesh flex">
      {/* Ambient orbs */}
      <div className="orb w-[500px] h-[500px] bg-sky-500 top-[-100px] left-[-150px]" />
      <div className="orb w-[400px] h-[400px] bg-violet-600 bottom-[-80px] right-[40%]" />

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-16 relative">
        <div className="max-w-md w-full animate-float-up">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-xl shadow-sky-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">Stratiq</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Marketing ops,<br />
            <span className="text-gradient-brand">beautifully managed.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-12 leading-relaxed">
            The digital marketing agency platform built for Mindshare Consulting.
          </p>

          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={f} className="flex items-center gap-3 animate-float-up" style={{ animationDelay: `${(i + 2) * 100}ms` }}>
                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-3 w-3 text-sky-400" />
                </div>
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="mt-14 grid grid-cols-3 gap-4">
            {[
              { value: '100%', label: 'Encrypted' },
              { value: 'Live', label: 'API Sync' },
              { value: 'Multi', label: 'Tenant' },
            ].map(stat => (
              <div key={stat.label} className="glass-card p-4 text-center">
                <p className="text-xl font-bold text-gradient-brand">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-md animate-float-up animate-delay-100">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-xl shadow-sky-500/30">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">Stratiq</span>
          </div>

          <div className="glass rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-slate-400 text-sm mb-8">Sign in to your agency dashboard</p>

            <form action="/api/auth/login" method="POST" className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-glass"
                  placeholder="you@agency.com"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                  <a href="#" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">Forgot password?</a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="input-glass pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <div className="relative flex items-center">
                  <input id="remember" name="remember" type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-white/[0.06] text-sky-500 focus:ring-sky-500 focus:ring-offset-0" />
                </div>
                <label htmlFor="remember" className="text-sm text-slate-400">Remember me for 30 days</label>
              </div>

              <button
                type="submit"
                className="btn-brand w-full py-3 rounded-xl text-sm mt-2 flex items-center justify-center gap-2 group"
              >
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
              <p className="text-slate-500 text-sm">
                New to Stratiq?{' '}
                <a href="#" className="text-sky-400 hover:text-sky-300 font-medium transition-colors">Contact your admin</a>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Protected by AES-256-GCM encryption · Multi-tenant isolated
          </p>
        </div>
      </div>
    </div>
  )
}
