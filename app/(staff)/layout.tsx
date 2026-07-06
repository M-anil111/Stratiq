'use client'
import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { GlobalSearch } from '@/components/GlobalSearch'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import ChangelogButton from '@/components/ChangelogButton'
import ImpersonationBanner from '@/components/ImpersonationBanner'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('global-search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="min-h-screen bg-mesh">
      {/* App-level "view as" banner — mounts above everything, renders nothing when inactive. */}
      <ImpersonationBanner />
      <Sidebar />
      <div className="lg:ml-20 pb-20 lg:pb-0 min-h-screen flex flex-col">
        {/* Top header with search */}
        <header className="sticky top-0 z-20 flex items-center px-4 py-2 lg:px-6 glass-sidebar border-b border-slate-900/[0.06] dark:border-white/[0.06]">
          <div className="flex-1 lg:flex lg:justify-end">
            <GlobalSearch />
          </div>
          <div className="ml-2 shrink-0 flex items-center gap-1">
            <ChangelogButton />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
