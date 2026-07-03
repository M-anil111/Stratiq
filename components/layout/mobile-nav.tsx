'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Users, BarChart3, Target, MoreHorizontal, UserCog, Settings, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/targets', label: 'Targets', icon: Target },
]

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex items-center">
        {tabs.map(tab => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                isActive ? 'text-sky-600' : 'text-gray-500'
              )}
            >
              <tab.icon className={cn('h-5 w-5', isActive && 'text-sky-500')} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn('flex-1 flex flex-col items-center gap-0.5 py-2 text-xs', moreOpen ? 'text-sky-600' : 'text-gray-500')}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* More slide-up panel */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-900">More</h3>
              <button onClick={() => setMoreOpen(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <Link href="/team" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 py-3 text-gray-700 border-b border-gray-100">
              <UserCog className="h-5 w-5 text-gray-500" />
              <span className="font-medium">Team</span>
            </Link>
            <Link href="/settings" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 py-3 text-gray-700 border-b border-gray-100">
              <Settings className="h-5 w-5 text-gray-500" />
              <span className="font-medium">Settings</span>
            </Link>
            <button className="flex items-center gap-3 py-3 text-red-600 w-full">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
