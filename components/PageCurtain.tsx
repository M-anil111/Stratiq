'use client'
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

const SESSION_KEY = 'stratiq-curtain-shown'

// Branded first-load overlay: the Stratiq mark "heartbeats" in, holds
// briefly, then wipes away. Shows once per browser session (not on every
// navigation — this is a daily-use tool, not a marketing site, so repeating
// it on every click would just slow people down). Respects
// prefers-reduced-motion and can never get stuck open (hard timeout).
export default function PageCurtain() {
  const [phase, setPhase] = useState<'hidden' | 'showing' | 'revealing'>('hidden')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')

    setPhase('showing')
    const revealTimer = setTimeout(() => setPhase('revealing'), 780)
    const doneTimer = setTimeout(() => setPhase('hidden'), 780 + 580 + 100)
    return () => {
      clearTimeout(revealTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none transition-transform duration-[580ms] ease-[cubic-bezier(.65,0,.35,1)] ${
        phase === 'revealing' ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{ background: 'linear-gradient(160deg, #0a1628 0%, #060a12 100%)' }}
    >
      <div className="curtain-logo w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-sky-500/40">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <style jsx>{`
        .curtain-logo {
          opacity: 0;
          transform: scale(0.82);
          animation: curtainHeartbeat 0.95s cubic-bezier(0.3, 0.6, 0.35, 1) forwards;
        }
        @keyframes curtainHeartbeat {
          0% { opacity: 0; transform: scale(0.82); }
          55% { opacity: 1; transform: scale(1.06); }
          75% { transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
