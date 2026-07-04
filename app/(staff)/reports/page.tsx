'use client'
import Link from 'next/link'
import { BarChart3, TrendingUp, Target, Layers, Sliders, Clock } from 'lucide-react'

const reportSections = [
  { href: '/reports/marketing', label: 'Marketing Reports', icon: BarChart3, description: 'Per-client unified monthly reports' },
  { href: '/reports/google-ads', label: 'Google Ads', icon: TrendingUp, description: 'Campaign performance from Google Ads' },
  { href: '/reports/meta-ads', label: 'Meta Ads', icon: Target, description: 'Facebook & Instagram ad performance' },
  { href: '/reports/comparison', label: 'Comparison Reports', icon: Layers, description: 'Client vs client, month over month' },
  { href: '/reports/builder', label: 'Custom Reports', icon: Sliders, description: 'Build your own report from any data' },
  { href: '/reports/scheduled', label: 'Scheduled Reports', icon: Clock, description: 'Auto-send reports on a schedule' },
]

export default function ReportsPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 text-sm mt-0.5">Marketing performance, ad data, and custom analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportSections.map(section => (
          <Link key={section.href} href={section.href} className="glass-card p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 group-hover:bg-sky-500/20 transition-colors">
                <section.icon className="h-6 w-6" />
              </div>
              <h2 className="font-semibold text-white">{section.label}</h2>
            </div>
            <p className="text-sm text-slate-400">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
