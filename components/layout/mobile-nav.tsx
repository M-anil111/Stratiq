'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Users, BarChart3, Target, MoreHorizontal, Settings, LogOut, X, Sparkles, FileText, BookUser, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/targets', label: 'Targets', icon: Target },
]

const sheetLinks = [
  { href: '/contacts', label: 'Contacts', icon: BookUser },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function SheetLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: typeof BookUser; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] transition-all duration-200">
      <Icon className="h-5 w-5 text-slate-400 dark:text-slate-400" />
      <span className="font-medium">{label}</span>
    </Link>
  )
}

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center"
        style={{
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          borderTop: '1px solid var(--sidebar-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {tabs.map(tab => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-all duration-200',
                isActive ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-xl transition-all duration-200',
                isActive ? 'bg-sky-500/15' : ''
              )}>
                <tab.icon className={cn('h-5 w-5 transition-all duration-200', isActive ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500')} />
              </div>
              <span>{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn('flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors', moreOpen ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500')}
        >
          <div className={cn('p-1.5 rounded-xl transition-all duration-200', moreOpen ? 'bg-sky-500/15' : '')}>
            <MoreHorizontal className="h-5 w-5" />
          </div>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-6 animate-slide-up glass-sidebar"
            style={{
              background: 'var(--sidebar-bg)',
              border: '1px solid var(--surface-border)',
              borderBottom: 'none',
            }}>
            <div className="w-10 h-1 bg-slate-900/20 dark:bg-white/20 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">Stratiq</span>
              </div>
              <button onClick={() => setMoreOpen(false)} className="p-2 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {sheetLinks.map((link) => (
                <SheetLink key={link.href} {...link} onClick={() => setMoreOpen(false)} />
              ))}
              <div className="divider-glass my-3" />
              <button
                onClick={() => { setMoreOpen(false); handleLogout() }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-all duration-200">
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
