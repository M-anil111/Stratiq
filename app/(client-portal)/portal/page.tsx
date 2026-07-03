import Link from 'next/link'
import { FolderOpen, Files, MessageSquare, ArrowRight, TrendingUp } from 'lucide-react'

export default function PortalHomePage() {
  return (
    <div>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Good morning 👋</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your projects</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">—</p>
          <p className="text-xs text-gray-500 mt-1">Active Projects</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">—</p>
          <p className="text-xs text-gray-500 mt-1">Files</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">—</p>
          <p className="text-xs text-gray-500 mt-1">Messages</p>
        </div>
      </div>

      {/* Upsell cards placeholder */}
      <div className="mb-8 p-4 bg-sky-50 border border-sky-200 rounded-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sky-900">Grow 3x faster with Google Ads</p>
            <p className="text-sm text-sky-700 mt-1">Get a free audit and see how paid search can triple your leads.</p>
            <Link href="#" className="inline-block mt-3 px-4 py-1.5 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors">
              Get Free Audit
            </Link>
          </div>
          <button className="text-sky-400 hover:text-sky-600 text-sm ml-4">Dismiss</button>
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">Quick Links</h2>
        {[
          { href: '/portal/projects', label: 'View My Projects', icon: FolderOpen },
          { href: '/portal/reports', label: 'Download Reports', icon: TrendingUp },
          { href: '/portal/files', label: 'Browse Files', icon: Files },
          { href: '/portal/messages', label: 'Send a Message', icon: MessageSquare },
        ].map(link => (
          <Link key={link.href} href={link.href} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <link.icon className="h-4 w-4 text-gray-600" />
              </div>
              <span className="font-medium text-gray-800">{link.label}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-sky-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
