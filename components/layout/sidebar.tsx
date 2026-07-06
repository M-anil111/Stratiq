'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, BarChart3, Target, Settings,
  FolderKanban, Sparkles, FileText, BookUser, Magnet, Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Magnet },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/contacts', label: 'Contacts', icon: BookUser },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/social', label: 'Social', icon: Share2 },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/targets', label: 'Targets', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col h-screen w-20 glass-sidebar text-slate-700 dark:text-slate-100 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center h-16 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
          <Sparkles className="h-4.5 w-4.5 text-white" style={{ width: '1.1rem', height: '1.1rem' }} />
        </div>
      </div>

      <div className="divider-glass mx-3" />

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                'flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl text-[10px] font-medium transition-all duration-200 relative group',
                isActive
                  ? 'nav-active text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-sky-400 to-blue-500 rounded-r-full" style={{ boxShadow: '0 0 8px rgba(14,165,233,0.8)' }} />
              )}
              <item.icon
                className={cn('transition-all duration-200', isActive ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300')}
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
              <span className="leading-none text-center">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
