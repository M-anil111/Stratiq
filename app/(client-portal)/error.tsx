'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PortalError({
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
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Something went wrong</h2>
        <p className="text-slate-400 text-sm">
          An error occurred while loading this page. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-600 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-brand flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <Link href="/portal" className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
