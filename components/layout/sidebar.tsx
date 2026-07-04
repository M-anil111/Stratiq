'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Users, BarChart3, Target, UserCog, Settings,
  ChevronLeft, ChevronRight, Plus, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/targets', label: 'Activity & Targets', icon: Target },
  { href: '/team', label: 'Team', icon: UserCog },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside className={cn(
      'hidden lg:flex flex-col h-screen glass-sidebar text-slate-100 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] fixed left-0 top-0 z-30',
      collapsed ? 'w-[68px]' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/10 to-transparent pointer-events-none" />
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{background:'linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.7) 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Stratiq</span>
          </div>
        ) : (
          <div className="mx-auto w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      <div className="divider-glass mx-3" />

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto space-y-0.5">
        {navItems.map((item, i) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                isActive
                  ? 'nav-active text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-sky-400 to-blue-500 rounded-r-full -ml-2" style={{boxShadow:'0 0 8px rgba(14,165,233,0.8)'}} />
              )}
              <item.icon className={cn('shrink-0 transition-all duration-200', isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300')} style={{width:'1.1rem',height:'1.1rem'}} />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-3 px-3 py-1.5 glass rounded-lg text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="divider-glass mx-3" />

      <div className="p-3">
        {!collapsed ? (
          <Link href="/clients/new" className="btn-brand flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm">
            <Plus className="h-4 w-4" />
            New Client
          </Link>
        ) : (
          <Link href="/clients/new" className="btn-brand flex items-center justify-center w-full py-2.5 rounded-xl">
            <Plus className="h-4 w-4" />
          </Link>
        )}
      </div>

      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-center h-10 text-slate-500 hover:text-white transition-colors border-t border-white/[0.05] hover:bg-white/[0.04]"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  )
}
