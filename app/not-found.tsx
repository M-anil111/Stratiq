import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="glass-card p-8 max-w-md text-center space-y-4">
        <div className="text-6xl font-bold text-slate-600">404</div>
        <h1 className="text-2xl font-bold text-white">Page not found</h1>
        <p className="text-slate-400">The page you&apos;re looking for doesn&apos;t exist.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn-brand flex items-center gap-2">
            <Home className="w-4 h-4" /> Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
