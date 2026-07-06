import Link from 'next/link'
import {
  Building2, Plug, Bell, Sliders, Shield, Globe,
  ShieldCheck, ListChecks, Mail, Users, CreditCard, History,
} from 'lucide-react'

const GROUPS = [
  {
    title: 'Account',
    items: [
      { href: '/settings/company', icon: Building2, label: 'Account Defaults', description: 'Organization name, logo, and branding' },
      { href: '/settings/billing', icon: CreditCard, label: 'Billing', description: 'Plan details and subscription management' },
      { href: '/settings/audit-log', icon: ShieldCheck, label: 'Audit Log', description: 'Track all actions taken across your organization' },
      { href: '/settings/changelog', icon: History, label: 'Changelog', description: "What's new and recently shipped in Stratiq" },
    ],
  },
  {
    title: 'Users & Teams',
    items: [
      { href: '/settings/team', icon: Users, label: 'Team', description: 'Manage team members and their roles' },
      { href: '/settings/notification-recipients', icon: Mail, label: 'Notification Recipients', description: 'Email addresses for report and lead alert notifications' },
    ],
  },
  {
    title: 'Data Management',
    items: [
      { href: '/settings/custom-fields', icon: Sliders, label: 'Custom Fields', description: 'Add custom fields to clients and projects' },
      { href: '/settings/masters', icon: ListChecks, label: 'Data Sets', description: 'Manage dropdown values: industries, goals, billing terms, and more' },
      { href: '/settings/directory-sites', icon: Globe, label: 'Directory Sites', description: 'Manage websites used in off-page submission dropdowns' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/settings/integrations', icon: Plug, label: 'Integrations', description: 'Connect Google Ads, Meta Ads, Drive, and more' },
      { href: '/settings/notifications', icon: Bell, label: 'Notifications', description: 'Email and push notification preferences' },
      { href: '/settings/security', icon: Shield, label: 'Security & Sessions', description: 'Sessions, 2FA, and access controls' },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">Configure Stratiq for your organization</p>
      </div>

      <div className="space-y-8">
        {GROUPS.map(group => (
          <section key={group.title}>
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">{group.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.items.map(item => (
                <Link key={item.href} href={item.href} className="flex items-start gap-4 p-5 glass-card hover:shadow-md transition-shadow group">
                  <div className="p-3 bg-slate-900/[0.04] dark:bg-white/[0.05] rounded-xl text-slate-600 dark:text-slate-400 group-hover:bg-sky-500/10 group-hover:text-sky-400 transition-colors shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{item.label}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
