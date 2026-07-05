'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="glass-card p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="text-slate-400">An unexpected error occurred. Please try again.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-brand flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <Link href="/dashboard" className="btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
