'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Building2, Plug, Bell, Sliders, Shield, Globe,
  ShieldCheck, ListChecks, Users, CreditCard, Mail,
  Search, History, Menu, X, Database,
} from 'lucide-react'

type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Account',
    items: [
      { href: '/settings/company', icon: Building2, label: 'Account Defaults' },
      { href: '/settings/billing', icon: CreditCard, label: 'Billing' },
      { href: '/settings/audit-log', icon: ShieldCheck, label: 'Audit Log' },
      { href: '/settings/changelog', icon: History, label: 'Changelog' },
      { href: '/settings/database', icon: Database, label: 'Database' },
    ],
  },
  {
    title: 'Users & Teams',
    items: [
      { href: '/settings/team', icon: Users, label: 'Team' },
      { href: '/settings/notification-recipients', icon: Mail, label: 'Notification Recipients' },
    ],
  },
  {
    title: 'Data Management',
    items: [
      { href: '/settings/custom-fields', icon: Sliders, label: 'Custom Fields' },
      { href: '/settings/masters', icon: ListChecks, label: 'Data Sets' },
      { href: '/settings/directory-sites', icon: Globe, label: 'Directory Sites' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/settings/integrations', icon: Plug, label: 'Integrations' },
      { href: '/settings/notifications', icon: Bell, label: 'Notifications' },
      { href: '/settings/security', icon: Shield, label: 'Security' },
    ],
  },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const groups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => !q || i.label.toLowerCase().includes(q)) }))
    .filter(g => g.items.length > 0)

  const Nav = (
    <nav className="flex flex-col gap-5">
      {/* Search settings */}
      <div className="relative px-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search settings"
          className="input-glass w-full pl-9 pr-3 py-2 rounded-xl text-sm"
        />
      </div>

      {groups.length === 0 && (
        <p className="px-3 text-sm text-slate-500">No settings match &ldquo;{query}&rdquo;</p>
      )}

      {groups.map(group => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
            {group.title}
          </p>
          {group.items.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-white/[0.07] py-6 px-3">
        {Nav}
      </aside>

      {/* Mobile trigger */}
      <div className="lg:hidden fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg"
        >
          <Menu className="h-4 w-4" /> Settings
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="w-72 max-w-[85%] bg-slate-950 border-l border-white/[0.07] py-6 px-3 overflow-y-auto">
            <div className="flex items-center justify-between px-2 mb-4">
              <span className="text-sm font-semibold text-white">Settings</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            {Nav}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
