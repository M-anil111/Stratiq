'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart3, TrendingUp, Target, Layers, Sliders, Clock, LineChart, Share2,
  DollarSign, MousePointer, CheckCircle2, Percent, Printer,
} from 'lucide-react'
import { TrendChart, ComparisonBar, BreakdownPie, colorAt } from '@/components/charts'
import DateRangeControl, { DeltaChip } from './_components/DateRangeControl'
import { useDateRange, pctDelta } from './_components/useDateRange'
import { openBrandedPrint, metricTableHtml } from './_components/printReport'

const reportSections = [
  { href: '/reports/marketing', label: 'Marketing Reports', icon: BarChart3, description: 'Per-client unified monthly reports' },
  { href: '/reports/ads', label: 'Ads Analysis', icon: LineChart, description: 'Cross-client Meta & Google ads performance and ROI' },
  { href: '/reports/google-ads', label: 'Google Ads', icon: TrendingUp, description: 'Campaign performance from Google Ads' },
  { href: '/reports/meta-ads', label: 'Meta Ads', icon: Target, description: 'Facebook & Instagram ad performance' },
  { href: '/reports/social', label: 'Social Analytics', icon: Share2, description: 'Published post engagement across all platforms' },
  { href: '/reports/comparison', label: 'Comparison Reports', icon: Layers, description: 'Client vs client, month over month' },
  { href: '/reports/builder', label: 'Custom Reports', icon: Sliders, description: 'Build your own report from any data' },
  { href: '/reports/scheduled', label: 'Scheduled Reports', icon: Clock, description: 'Auto-send reports on a schedule' },
]

const fmtNum = (n: number) => (n || 0).toLocaleString()
const fmtCur = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtMonth = (key: string) => {
  const [y, m] = String(key).split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

interface AdsReport {
  summary: { spend: number; clicks: number; conversions: number; revenue: number; roas: number; impressions: number }
  by_network: Record<string, { spend: number; revenue: number }>
  by_month: { month: string; spend: number; revenue: number; clicks: number }[]
}
interface SocialReport {
  summary: { published: number; failed: number; scheduled: number; success_rate: number }
  by_platform: { platform: string; published: number; engagement: { impressions: number } }[]
}

function Tile({ label, value, icon: Icon, tone, delta, invert }: {
  label: string; value: string; icon: any; tone: string; delta?: number | null; invert?: boolean
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        {delta != null && <DeltaChip delta={delta} invert={invert} />}
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

export default function ReportsPage() {
  const range = useDateRange('30d')
  const [ads, setAds] = useState<AdsReport | null>(null)
  const [social, setSocial] = useState<SocialReport | null>(null)
  const [socialPrev, setSocialPrev] = useState<SocialReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ start: range.start, end: range.end })
    const jobs: Promise<any>[] = [
      fetch('/api/reports/ads?months=6').then(r => r.json()).then(d => setAds(d?.summary ? d : null)).catch(() => setAds(null)),
      fetch(`/api/reports/social?${p}`).then(r => r.json()).then(setSocial).catch(() => setSocial(null)),
    ]
    if (range.compare) {
      const pc = new URLSearchParams({ start: range.compareStart, end: range.compareEnd })
      jobs.push(fetch(`/api/reports/social?${pc}`).then(r => r.json()).then(setSocialPrev).catch(() => setSocialPrev(null)))
    } else {
      setSocialPrev(null)
    }
    Promise.all(jobs).finally(() => setLoading(false))
  }, [range.start, range.end, range.compare, range.compareStart, range.compareEnd])

  const networkPie = useMemo(() => {
    const bn = ads?.by_network || {}
    return [
      { name: 'Meta', value: Number(bn.meta?.spend || 0), color: colorAt(1) },
      { name: 'Google', value: Number(bn.google?.spend || 0), color: colorAt(2) },
    ]
  }, [ads])

  const platformBars = useMemo(() =>
    (social?.by_platform || []).slice(0, 8).map(p => ({
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      published: p.published,
    })), [social])

  const sd = social?.summary
  const spd = socialPrev?.summary

  const downloadPdf = () => {
    const s = ads?.summary
    openBrandedPrint({
      title: 'Reports Overview',
      periodLabel: range.rangeLabel,
      sections: [
        {
          heading: 'Advertising (last 6 months)',
          html: metricTableHtml([
            ['Spend', fmtCur(s?.spend || 0)],
            ['Impressions', fmtNum(s?.impressions || 0)],
            ['Clicks', fmtNum(s?.clicks || 0)],
            ['Conversions', fmtNum(s?.conversions || 0)],
            ['Revenue', fmtCur(s?.revenue || 0)],
            ['ROAS', s?.spend ? `${(s?.roas || 0).toFixed(2)}x` : '—'],
          ]),
        },
        {
          heading: `Social publishing (${range.rangeLabel})`,
          html: metricTableHtml([
            ['Published', fmtNum(sd?.published || 0)],
            ['Failed', fmtNum(sd?.failed || 0)],
            ['Scheduled', fmtNum(sd?.scheduled || 0)],
            ['Success rate', `${sd?.success_rate || 0}%`],
          ]),
        },
      ],
    })
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Marketing performance, ad data, and custom analytics</p>
        </div>
        <button onClick={downloadPdf} className="btn-brand inline-flex items-center gap-1.5 text-sm px-4 py-2.5">
          <Printer className="h-4 w-4" /> Download PDF
        </button>
      </div>

      <DateRangeControl range={range} className="mb-6" />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Tile label="Ad Spend (6mo)" value={fmtCur(ads?.summary.spend || 0)} icon={DollarSign} tone="bg-emerald-500/10 text-emerald-400" />
        <Tile label="Clicks (6mo)" value={fmtNum(ads?.summary.clicks || 0)} icon={MousePointer} tone="bg-violet-500/10 text-violet-400" />
        <Tile label="Conversions (6mo)" value={fmtNum(ads?.summary.conversions || 0)} icon={Target} tone="bg-teal-500/10 text-teal-400" />
        <Tile label="ROAS (6mo)" value={ads?.summary.spend ? `${(ads?.summary.roas || 0).toFixed(2)}x` : '—'} icon={BarChart3} tone="bg-amber-500/10 text-amber-400" />
        <Tile label="Posts Published" value={fmtNum(sd?.published || 0)} icon={CheckCircle2} tone="bg-sky-500/10 text-sky-400"
          delta={range.compare && spd ? pctDelta(sd?.published || 0, spd.published || 0) : null} />
        <Tile label="Success Rate" value={`${sd?.success_rate || 0}%`} icon={Percent} tone="bg-pink-500/10 text-pink-400"
          delta={range.compare && spd ? pctDelta(sd?.success_rate || 0, spd.success_rate || 0) : null} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Spend & revenue trend</h2>
          <p className="text-xs text-slate-500 mb-4">Monthly ad spend with revenue overlay (last 6 months)</p>
          <TrendChart
            data={ads?.by_month || []}
            xKey="month"
            xTickFormatter={fmtMonth}
            yTickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            series={[
              { key: 'spend', label: 'Spend', color: colorAt(0) },
              { key: 'revenue', label: 'Revenue', color: colorAt(2) },
            ]}
          />
        </div>
        <div className="glass-card p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Spend by network</h2>
          <p className="text-xs text-slate-500 mb-4">Meta vs Google split</p>
          <BreakdownPie data={networkPie} valueFormatter={fmtCur} />
        </div>
      </div>

      <div className="glass-card p-5 mb-8">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Posts published by platform</h2>
        <p className="text-xs text-slate-500 mb-4">{range.rangeLabel}</p>
        <ComparisonBar data={platformBars} xKey="platform" colorByCategory series={[{ key: 'published', label: 'Published' }]} />
      </div>

      {loading && <p className="text-xs text-slate-500 mb-6">Refreshing…</p>}

      {/* Report navigation */}
      <h2 className="font-semibold text-slate-900 dark:text-white mb-3">All reports</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportSections.map(section => (
          <Link key={section.href} href={section.href} className="glass-card p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 group-hover:bg-sky-500/20 transition-colors">
                <section.icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-slate-900 dark:text-white">{section.label}</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
