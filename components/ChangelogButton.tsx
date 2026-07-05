'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'

/**
 * "What's new" button showing the current version and an unseen-release dot.
 * Tracks the last seen version in localStorage (`changelog_seen_version`).
 * Drop into any header. Navigating to /changelog marks the version seen.
 */
export default function ChangelogButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [hasUnseen, setHasUnseen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem('changelog_seen_version')
      setHasUnseen(seen !== APP_VERSION)
    } catch {
      setHasUnseen(false)
    }
  }, [])

  const handleClick = () => {
    try {
      localStorage.setItem('changelog_seen_version', APP_VERSION)
    } catch {}
    setHasUnseen(false)
    router.push('/changelog')
  }

  return (
    <button
      onClick={handleClick}
      title="What's new"
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors ${className}`}
    >
      <Sparkles className="h-4 w-4 text-sky-400" />
      <span className="hidden sm:inline">What&apos;s new</span>
      <span className="text-xs text-slate-500">v{APP_VERSION}</span>
      {hasUnseen && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-slate-900" />
      )}
    </button>
  )
}
