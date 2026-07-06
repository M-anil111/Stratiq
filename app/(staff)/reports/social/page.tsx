'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, XCircle, CalendarClock, Percent, Rocket, AlertTriangle,
  BarChart3, Download, ExternalLink, Wrench, Printer,
} from 'lucide-react'
import { downloadCsv } from '@/lib/csv'
import { BreakdownPie, ComparisonBar, colorAt } from '@/components/charts'
import DateRangeControl, { DeltaChip } from '../_components/DateRangeControl'
import { useDateRange, pctDelta } from '../_components/useDateRange'
import { openBrandedPrint, metricTableHtml } from '../_components/printReport'

interface EngagementTotals {
  likes: number; comments_count: number; shares: number
  impressions: number; reach: number; clicks: number
}
interface PlatformRow {
  platform: string
  published: number
  failed: number
  engagement: EngagementTotals
}
interface FailureRow {
  id: string
  platform: string
  failed_reason: string | null
  retry_count: number
  content_preview: string
  scheduled_date: string | null
}
interface LaunchRow {
  id: string
  platform: string
  content_snippet: string
  permalink: string | null
  published_at: string | null
}
interface ReportData {
  summary: { published: number; failed: number; scheduled: number; success_rate: number }
  by_platform: PlatformRow[]
  failures: FailureRow[]
  launches: LaunchRow[]
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E4405F', twitter: '#1DA1F2', x: '#0f0f0f',
  linkedin: '#0A66C2', youtube: '#FF0000', tiktok: '#000000', pinterest: '#BD081C',
  threads: '#000000', google: '#4285F4',
}
function platformColor(p: string) { return PLATFORM_COLORS[(p || '').toLowerCase()] || '#64748b' }
function labelize(p: string) { return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Unknown' }
function fmt(n: number) { return (n || 0).toLocaleString() }
function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const selectClass = "bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: platformColor(platform) }}
    >
      {labelize(platform)}
    </span>
  )
}

function Tile({ label, value, icon: Icon, tone, delta, invert }: { label: string; value: string; icon: any; tone?: string; delta?: number | null; invert?: boolean }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${tone || 'text-slate-600 dark:text-slate-400'}`}>
          <Icon className="h-4 w-4" />
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        {delta != null && <DeltaChip delta={delta} invert={invert} />}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

export default function SocialPublishingReportPage() {
  const range = useDateRange('30d')
  const [data, setData] = useState<ReportData | null>(null)
  const [prev, setPrev] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ start: range.start, end: range.end })
    const jobs: Promise<any>[] = [
      fetch(`/api/reports/social?${params.toString()}`).then(r => r.json()).then(setData).catch(() => setData(null)),
    ]
    if (range.compare) {
      const pc = new URLSearchParams({ start: range.compareStart, end: range.compareEnd })
      jobs.push(fetch(`/api/reports/social?${pc.toString()}`).then(r => r.json()).then(setPrev).catch(() => setPrev(null)))
    } else {
      setPrev(null)
    }
    Promise.all(jobs).finally(() => setLoading(false))
  }, [range.start, range.end, range.compare, range.compareStart, range.compareEnd])

  const exportPlatforms = () => {
    if (!data?.by_platform?.length) return
    downloadCsv('social-platform-breakdown.csv', data.by_platform.map(p => ({
      platform: labelize(p.platform),
      published: p.published,
      failed: p.failed,
      likes: p.engagement.likes,
      comments: p.engagement.comments_count,
      shares: p.engagement.shares,
      impressions: p.engagement.impressions,
      reach: p.engagement.reach,
      clicks: p.engagement.clicks,
    })))
  }

  const exportFailures = () => {
    if (!data?.failures?.length) return
    downloadCsv('social-failures.csv', data.failures.map(f => ({
      platform: labelize(f.platform),
      failed_reason: f.failed_reason || '',
      retry_count: f.retry_count,
      scheduled_date: f.scheduled_date || '',
      content: f.content_preview,
    })))
  }

  const downloadPdf = () => {
    if (!data) return
    openBrandedPrint({
      title: 'Social Publishing Report',
      periodLabel: range.rangeLabel,
      sections: [
        {
          heading: 'Summary',
          html: metricTableHtml([
            ['Published', fmt(data.summary.published)],
            ['Failed', fmt(data.summary.failed)],
            ['Scheduled', fmt(data.summary.scheduled)],
            ['Success rate', `${data.summary.success_rate}%`],
          ]),
        },
        {
          heading: 'By platform',
          html: metricTableHtml(data.by_platform.map(p =>
            [labelize(p.platform), `${fmt(p.published)} published · ${fmt(p.engagement.impressions)} impressions`] as [string, string])),
        },
      ],
    })
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Social Publishing Report</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Publishing success, failures, and recent launches</p>
        </div>
        <button onClick={downloadPdf} className="btn-brand inline-flex items-center gap-1.5 text-sm px-4 py-2.5">
          <Printer className="h-4 w-4" /> Download PDF
        </button>
      </div>

      <DateRangeControl range={range} className="mb-6" />

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="h-3 w-16 bg-slate-900/10 dark:bg-white/10 rounded mb-3" />
                <div className="h-6 w-12 bg-slate-900/10 dark:bg-white/10 rounded" />
              </div>
            ))}
          </div>
          <div className="glass-card p-6 animate-pulse h-48" />
          <div className="glass-card p-6 animate-pulse h-64" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Tile label="Published" value={fmt(data.summary.published)} icon={CheckCircle2} tone="text-emerald-400"
              delta={range.compare && prev ? pctDelta(data.summary.published, prev.summary.published) : null} />
            <Tile label="Failed" value={fmt(data.summary.failed)} icon={XCircle} tone="text-rose-400" invert
              delta={range.compare && prev ? pctDelta(data.summary.failed, prev.summary.failed) : null} />
            <Tile label="Scheduled" value={fmt(data.summary.scheduled)} icon={CalendarClock} tone="text-sky-400" />
            <Tile label="Success Rate" value={`${data.summary.success_rate}%`} icon={Percent} tone="text-amber-400"
              delta={range.compare && prev ? pctDelta(data.summary.success_rate, prev.summary.success_rate) : null} />
          </div>

          {/* Charts */}
          {data.by_platform.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="glass-card p-5">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Published by platform</h2>
                <p className="text-xs text-slate-500 mb-4">Share of posts published in this range</p>
                <BreakdownPie
                  data={data.by_platform.map((p, i) => ({ name: labelize(p.platform), value: p.published, color: colorAt(i) }))}
                />
              </div>
              <div className="glass-card p-5">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-1">Engagement by platform</h2>
                <p className="text-xs text-slate-500 mb-4">Likes, comments and shares</p>
                <ComparisonBar
                  data={data.by_platform.map(p => ({
                    platform: labelize(p.platform),
                    likes: p.engagement.likes,
                    comments: p.engagement.comments_count,
                    shares: p.engagement.shares,
                  }))}
                  xKey="platform"
                  series={[
                    { key: 'likes', label: 'Likes', color: colorAt(0) },
                    { key: 'comments', label: 'Comments', color: colorAt(3) },
                    { key: 'shares', label: 'Shares', color: colorAt(2) },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Per-platform breakdown */}
          <div className="glass-card p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Per-Platform Breakdown</h2>
              <button
                onClick={exportPlatforms}
                disabled={!data.by_platform.length}
                className="btn-brand inline-flex items-center gap-1.5 text-sm disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
            {data.by_platform.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">No platform activity in this range</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium text-right">Published</th>
                      <th className="pb-2 font-medium text-right">Failed</th>
                      <th className="pb-2 font-medium text-right">Likes</th>
                      <th className="pb-2 font-medium text-right">Comments</th>
                      <th className="pb-2 font-medium text-right">Shares</th>
                      <th className="pb-2 font-medium text-right">Impressions</th>
                      <th className="pb-2 font-medium text-right">Reach</th>
                      <th className="pb-2 font-medium text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_platform.map(p => (
                      <tr key={p.platform} className="border-t border-slate-900/10 dark:border-white/[0.08]">
                        <td className="py-2.5"><PlatformBadge platform={p.platform} /></td>
                        <td className="py-2.5 text-right text-emerald-700 dark:text-emerald-300">{fmt(p.published)}</td>
                        <td className="py-2.5 text-right text-rose-300">{fmt(p.failed)}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{fmt(p.engagement.likes)}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{fmt(p.engagement.comments_count)}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{fmt(p.engagement.shares)}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{fmt(p.engagement.impressions)}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{fmt(p.engagement.reach)}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{fmt(p.engagement.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Failures */}
          <div className="glass-card p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" /> Failures
              </h2>
              <button
                onClick={exportFailures}
                disabled={!data.failures.length}
                className="btn-brand inline-flex items-center gap-1.5 text-sm disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
            {data.failures.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
                <p className="text-sm">No failed posts in this range</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs uppercase tracking-wide">
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium">Reason</th>
                      <th className="pb-2 font-medium text-right">Retries</th>
                      <th className="pb-2 font-medium">Scheduled</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.failures.map(f => (
                      <tr key={f.id} className="border-t border-slate-900/10 dark:border-white/[0.08] align-top">
                        <td className="py-3 pr-3"><PlatformBadge platform={f.platform} /></td>
                        <td className="py-3 pr-3 text-slate-700 dark:text-slate-300 max-w-[360px]">
                          <span className="text-rose-300">{f.failed_reason || 'Unknown error'}</span>
                          {f.content_preview && (
                            <span className="block text-slate-500 text-xs mt-0.5 line-clamp-1">{f.content_preview}</span>
                          )}
                        </td>
                        <td className="py-3 text-right text-slate-700 dark:text-slate-300">{fmt(f.retry_count)}</td>
                        <td className="py-3 pr-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(f.scheduled_date)}</td>
                        <td className="py-3">
                          <Link
                            href="/social"
                            className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Wrench className="h-3.5 w-3.5" /> Retry / Fix
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Launches */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Rocket className="h-4 w-4 text-emerald-400" /> Launches
            </h2>
            {data.launches.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <Rocket className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">No published posts in this range</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-900/10 dark:divide-white/[0.06]">
                {data.launches.map(l => (
                  <li key={l.id} className="py-3 flex items-start gap-3">
                    <div className="pt-0.5"><PlatformBadge platform={l.platform} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-300 text-sm line-clamp-2">{l.content_snippet || '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{fmtDate(l.published_at)}</p>
                    </div>
                    {l.permalink && (
                      <a
                        href={l.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 inline-flex items-center shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
