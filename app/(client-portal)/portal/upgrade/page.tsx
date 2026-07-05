'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, Target, Search, Mail, Globe, MapPin, Sparkles, Phone } from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  'google-ads': TrendingUp,
  'meta-ads': Target,
  'local-seo': Search,
  'content-writing': Globe,
  'email-marketing': Mail,
  'social-media': Sparkles,
  'web-design': Globe,
}

const COLOR_MAP: Record<string, { gradient: string; iconColor: string; iconBg: string }> = {
  'google-ads':     { gradient: 'from-sky-500/10 to-blue-500/5',     iconColor: 'text-sky-400',    iconBg: 'bg-sky-500/10' },
  'meta-ads':       { gradient: 'from-violet-500/10 to-purple-500/5', iconColor: 'text-violet-400', iconBg: 'bg-violet-500/10' },
  'local-seo':      { gradient: 'from-emerald-500/10 to-teal-500/5', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
  'content-writing':{ gradient: 'from-amber-500/10 to-orange-500/5', iconColor: 'text-amber-400',   iconBg: 'bg-amber-500/10' },
  'email-marketing':{ gradient: 'from-rose-500/10 to-pink-500/5',    iconColor: 'text-rose-400',    iconBg: 'bg-rose-500/10' },
  'social-media':   { gradient: 'from-indigo-500/10 to-blue-500/5',  iconColor: 'text-indigo-400',  iconBg: 'bg-indigo-500/10' },
  'web-design':     { gradient: 'from-fuchsia-500/10 to-pink-500/5', iconColor: 'text-fuchsia-400', iconBg: 'bg-fuchsia-500/10' },
}

const FALLBACK_COLOR = { gradient: 'from-slate-500/10 to-slate-500/5', iconColor: 'text-slate-400', iconBg: 'bg-slate-500/10' }

const PRIORITY_BADGE: Record<string, string> = {
  high:   'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  low:    'bg-slate-500/20 text-slate-400 border border-slate-600/30',
}

interface Recommendation {
  id: string
  title: string
  description: string
  monthly_price: number
  priority: 'high' | 'medium' | 'low'
  category: string
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl glass-card border border-emerald-500/30 shadow-lg animate-float-up">
      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <p className="text-sm text-white font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white transition-colors text-lg leading-none">&times;</button>
    </div>
  )
}

function ServiceCardSkeleton() {
  return (
    <div className="glass-card p-6 flex flex-col animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-white/10 mb-4" />
      <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-3 bg-white/10 rounded w-full mb-2" />
      <div className="h-3 bg-white/10 rounded w-5/6 mb-4 flex-1" />
      <div className="h-8 bg-white/10 rounded w-full mt-auto" />
    </div>
  )
}

export default function PortalUpgradePage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/portal/upsell')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => setRecommendations(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const handleInterest = async (serviceId: string) => {
    setSubmitting(serviceId)
    try {
      await fetch('/api/portal/upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceId }),
      })
      setConfirmed(prev => new Set(prev).add(serviceId))
      setToast('Our team will reach out within 24 hours!')
      setTimeout(() => setToast(''), 5000)
    } catch {
      setToast('Something went wrong. Please try again.')
      setTimeout(() => setToast(''), 5000)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold mb-3">
          <span className="bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            Grow Your Business
          </span>
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Personalised recommendations based on your current services. Select anything that interests you and our team will reach out within 24 hours.
        </p>
      </div>

      {/* Service cards */}
      {error ? (
        <div className="glass-card p-8 text-center text-slate-400 mb-10">
          Unable to load recommendations. Please refresh the page.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <ServiceCardSkeleton key={i} />)
            : recommendations.map(rec => {
                const Icon = ICON_MAP[rec.id] || TrendingUp
                const colors = COLOR_MAP[rec.id] || FALLBACK_COLOR
                const isConfirmed = confirmed.has(rec.id)
                return (
                  <div
                    key={rec.id}
                    className={`glass-card p-6 flex flex-col bg-gradient-to-br ${colors.gradient} relative overflow-hidden`}
                  >
                    {/* Priority badge */}
                    <span className={`absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_BADGE[rec.priority]}`}>
                      {rec.priority === 'high' ? 'Recommended' : rec.priority}
                    </span>

                    <div className={`w-11 h-11 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}>
                      <Icon className={`h-5 w-5 ${colors.iconColor}`} />
                    </div>

                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{rec.category}</p>
                    <h2 className="text-lg font-semibold text-white mb-2">{rec.title}</h2>
                    <p className="text-sm text-slate-400 flex-1 mb-4">{rec.description}</p>
                    <p className="text-xs text-slate-500 mb-4">
                      Starting from <span className="text-white font-semibold">${rec.monthly_price.toLocaleString()}</span>/month
                    </p>

                    {isConfirmed ? (
                      <div className="flex items-center gap-2 justify-center py-2 text-emerald-400 text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        Interest noted — we&apos;ll be in touch!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInterest(rec.id)}
                        disabled={submitting === rec.id}
                        className="btn-brand w-full py-2 text-sm disabled:opacity-60"
                      >
                        {submitting === rec.id ? 'Sending...' : "I'm Interested"}
                      </button>
                    )}
                  </div>
                )
              })
          }
        </div>
      )}

      {/* CTA section */}
      <div className="glass-card p-8 text-center bg-gradient-to-br from-sky-500/10 via-transparent to-violet-500/10">
        <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <Phone className="h-5 w-5 text-sky-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Book a Free Strategy Call</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
          Not sure where to start? Talk to one of our specialists — we&apos;ll map out the highest-impact opportunities for your business at no cost.
        </p>
        {confirmed.has('strategy_call') ? (
          <p className="text-emerald-400 font-medium">All booked — we&apos;ll be in touch within 24 hours!</p>
        ) : (
          <button
            onClick={() => handleInterest('strategy_call')}
            disabled={submitting === 'strategy_call'}
            className="btn-brand px-8 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {submitting === 'strategy_call' ? 'Sending...' : 'Book a Free Strategy Call'}
          </button>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
