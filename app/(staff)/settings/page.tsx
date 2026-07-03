import Link from 'next/link'
import { Building2, Plug, Bell, Sliders, Shield } from 'lucide-react'

const settingsSections = [
  { href: '/settings/company', icon: Building2, label: 'Company Profile', description: 'Organization name, logo, and branding' },
  { href: '/settings/integrations', icon: Plug, label: 'Integrations', description: 'Connect Google Ads, Meta Ads, Drive, and more' },
  { href: '/settings/notifications', icon: Bell, label: 'Notifications', description: 'Email and push notification preferences' },
  { href: '/settings/custom-fields', icon: Sliders, label: 'Custom Fields', description: 'Add custom fields to clients and projects' },
  { href: '/settings/security', icon: Shield, label: 'Security & Sessions', description: 'Sessions, 2FA, and access controls' },
]

export default function SettingsPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Configure Stratiq for your organization</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsSections.map(section => (
          <Link key={section.href} href={section.href} className="flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="p-3 bg-gray-50 rounded-xl text-gray-600 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors shrink-0">
              <section.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{section.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
