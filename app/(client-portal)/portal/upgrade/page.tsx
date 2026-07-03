'use client'
import { useState, useEffect } from 'react'
import { Check, Zap, Star, ArrowRight } from 'lucide-react'

interface Recommendation {
  id: string
  title: string
  description: string
  monthly_price: number
  priority: string
  category: string
}

const priorityColors: Record<string, string> = {
  high: 'bg-amber-50 border-amber-200',
  medium: 'bg-sky-50 border-sky-200',
  low: 'bg-gray-50 border-gray-100',
}

const priorityBadges: Record<string, string> = {
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-sky-100 text-sky-800',
  low: 'bg-gray-100 text-gray-600',
}

export default function PortalUpgradePage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [interested, setInterested] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch('/api/portal/upsell').then(r => r.json()).then(d => { setRecommendations(d || []); setLoading(false) })
  }, [])

  const toggle = (id: string) => setInterested(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const handleSubmit = async () => {
    await fetch('/api/portal/upsell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interested_in: interested }),
    })
    setSubmitted(true)
  }

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  if (submitted) return (
    <div className="p-4 lg:p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <Check className="h-8 w-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h2>
      <p className="text-gray-500 max-w-sm">Your account manager will be in touch within 1 business day to discuss adding these services.</p>
    </div>
  )

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900">Grow Your Results</h1>
        </div>
        <p className="text-gray-500">Add services to amplify your marketing performance. Select the ones you're interested in and we'll reach out.</p>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Star className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">You're already on a comprehensive plan!</p>
          <p className="text-sm mt-1">Contact your account manager to discuss custom options</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {recommendations.map(rec => {
              const isSelected = interested.includes(rec.id)
              return (
                <button key={rec.id} onClick={() => toggle(rec.id)}
                  className={`text-left rounded-xl border p-5 transition-all ${isSelected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500' : priorityColors[rec.priority]}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadges[rec.priority]}`}>
                          {rec.priority === 'high' ? '🔥 Recommended' : rec.priority === 'medium' ? 'Popular' : rec.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-gray-300'}`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                  <p className="text-sm font-semibold text-gray-900">From ${rec.monthly_price.toLocaleString()}<span className="font-normal text-gray-500">/month</span></p>
                </button>
              )
            })}
          </div>

          {interested.length > 0 && (
            <div className="sticky bottom-4 bg-white rounded-xl border border-gray-100 shadow-lg p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-gray-700 font-medium">{interested.length} service{interested.length > 1 ? 's' : ''} selected</p>
              <button onClick={handleSubmit} className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg">
                Request a Quote <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
