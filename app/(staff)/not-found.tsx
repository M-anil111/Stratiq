import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function StaffNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-8 max-w-md text-center space-y-4">
        <div className="text-5xl font-bold text-slate-600">404</div>
        <h2 className="text-xl font-bold text-white">Page not found</h2>
        <p className="text-slate-400 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn-brand flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
