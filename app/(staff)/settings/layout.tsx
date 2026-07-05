'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, Plug, Bell, Sliders, Shield, Globe,
  ShieldCheck, ListChecks, Users, CreditCard, Mail,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/settings/company', icon: Building2, label: 'Company' },
  { href: '/settings/integrations', icon: Plug, label: 'Integrations' },
  { href: '/settings/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings/notification-recipients', icon: Mail, label: 'Recipients' },
  { href: '/settings/custom-fields', icon: Sliders, label: 'Custom Fields' },
  { href: '/settings/security', icon: Shield, label: 'Security' },
  { href: '/settings/directory-sites', icon: Globe, label: 'Directory Sites' },
  { href: '/settings/audit-log', icon: ShieldCheck, label: 'Audit Log' },
  { href: '/settings/masters', icon: ListChecks, label: 'Masters' },
  { href: '/settings/team', icon: Users, label: 'Team' },
  { href: '/settings/billing', icon: CreditCard, label: 'Billing' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-full">
      {/* Sidebar nav */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-white/[0.07] py-6 px-3 gap-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Settings</p>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
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
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
