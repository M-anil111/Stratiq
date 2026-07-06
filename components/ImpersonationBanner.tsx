'use client'
import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'

/**
 * Sticky warning banner shown while a Super Admin is viewing the app "as"
 * another user. This is an app-level view-as (acting identity/role), not a
 * Supabase auth session swap. Renders nothing when not impersonating.
 */
export default function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState(false)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !data) return
        if (data.impersonating) {
          setImpersonating(true)
          setName(data.acting_as || data.full_name || 'user')
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function handleReturn() {
    setEnding(true)
    try {
      await fetch('/api/team/self/impersonate', { method: 'DELETE' }).catch(() => {})
    } finally {
      // The route id is not used by DELETE, but keep a valid path.
      window.location.reload()
    }
  }

  if (!impersonating) return null

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-medium text-center">
        <span className="flex items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" />
          Viewing as {name} — changes are logged
        </span>
        <button
          onClick={handleReturn}
          disabled={ending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950/90 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-950 disabled:opacity-60"
        >
          {ending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Return to your account
        </button>
      </div>
    </div>
  )
}
