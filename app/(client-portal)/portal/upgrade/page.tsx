'use client'
import { useState } from 'react'
import { TrendingUp, Target, Search, Phone } from 'lucide-react'

const SERVICES = [
  {
    id: 'google_ads',
    icon: TrendingUp,
    title: 'Google Ads',
    description: 'Reach high-intent customers at the exact moment they search. Data-driven campaigns that maximise your return on ad spend.',
    price: '$800',
    color: 'from-sky-500/10 to-blue-500/5',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
  },
  {
    id: 'meta_ads',
    icon: Target,
    title: 'Meta Ads',
    description: 'Laser-targeted Facebook & Instagram campaigns that build brand awareness and drive conversions across your ideal audience.',
    price: '$700',
    color: 'from-violet-500/10 to-purple-500/5',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
  },
  {
    id: 'seo_package',
    icon: Search,
    title: 'SEO Package',
    description: 'Dominate organic search rankings with on-page optimisation, link building, and content strategy that compounds over time.',
    price: '$1,200',
    color: 'from-emerald-500/10 to-teal-500/5',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
]

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl glass-card border border-emerald-500/30 shadow-lg animate-float-up">
      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <p className="text-sm text-white font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white transition-colors text-lg leading-none">&times;</button>
    </div>
  )
}

export default function PortalUpgradePage() {
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const handleCta = async (serviceId: string) => {
    setLoading(serviceId)
    await fetch('/api/portal/upsell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: serviceId }),
    }).catch(() => {})
    setLoading(null)
    setToast('Our team will reach out within 24 hours!')
    setTimeout(() => setToast(''), 5000)
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
          Supercharge your marketing with our proven services. Select what you need and our team will tailor a strategy just for you.
        </p>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        {SERVICES.map(svc => {
          const Icon = svc.icon
          return (
            <div
              key={svc.id}
              className={`glass-card p-6 flex flex-col bg-gradient-to-br ${svc.color} animate-float-up relative overflow-hidden`}
            >
              <div className={`w-11 h-11 rounded-xl ${svc.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`h-5 w-5 ${svc.iconColor}`} />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">{svc.title}</h2>
              <p className="text-sm text-slate-400 flex-1 mb-4">{svc.description}</p>
              <p className="text-xs text-slate-500 mb-4">Starting from <span className="text-white font-semibold">{svc.price}</span>/month</p>
              <button
                onClick={() => handleCta(svc.id)}
                disabled={loading === svc.id}
                className="btn-brand w-full py-2 text-sm disabled:opacity-60"
              >
                {loading === svc.id ? 'Sending...' : 'Get Started'}
              </button>
            </div>
          )
        })}
      </div>

      {/* CTA section */}
      <div className="glass-card p-8 text-center bg-gradient-to-br from-sky-500/10 via-transparent to-violet-500/10">
        <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <Phone className="h-5 w-5 text-sky-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Book a Free Strategy Call</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
          Not sure where to start? Talk to one of our specialists — we'll map out the highest-impact opportunities for your business at no cost.
        </p>
        <button
          onClick={() => handleCta('strategy_call')}
          disabled={loading === 'strategy_call'}
          className="btn-brand px-8 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {loading === 'strategy_call' ? 'Sending...' : 'Book a Free Strategy Call'}
        </button>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
