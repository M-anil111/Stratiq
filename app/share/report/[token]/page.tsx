'use client'
import { useState, useEffect } from 'react'
import { BarChart3, Link2 } from 'lucide-react'

interface SharedReport {
  client_company_name: string
  agency_name: string
  month: string
  notes: string | null
  meta_impressions: number | null
  meta_clicks: number | null
  meta_spend: number | null
  meta_roas: number | null
  meta_reach: number | null
  meta_conversions: number | null
  meta_revenue: number | null
  meta_period_start: string | null
  meta_period_end: string | null
  google_impressions: number | null
  google_clicks: number | null
  google_spend: number | null
  google_roas: number | null
  google_conversions: number | null
  google_revenue: number | null
  google_period_start: string | null
  google_period_end: string | null
  seo_offpage_count: number | null
  seo_blog_count: number | null
  seo_onpage_count: number | null
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function monthLabel(month: string) {
  const [y, m] = month.split('-')
  const idx = parseInt(m) - 1
  return `${MONTHS[idx] || m} ${y}`
}

function fmtNum(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString()
}

function fmtMoney(v: number | null) {
  if (v == null) return '—'
  return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function ctr(clicks: number | null, impressions: number | null) {
  if (clicks && impressions) return ((clicks / impressions) * 100).toFixed(2) + '%'
  return '—'
}

function MetricGrid({ title, subtitle, stats }: { title: string; subtitle?: string; stats: { label: string; value: string }[] }) {
  return (
    <div className="glass-card mb-4 p-5">
      <h2 className="font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mb-1">{subtitle}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {stats.map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs font-medium text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SharedReportPage({ params }: { params: { token: string } }) {
  const [report, setReport] = useState<SharedReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    fetch(`/api/share/report/${params.token}`)
      .then(async r => {
        if (!r.ok) { setInvalid(true); return }
        const data = await r.json()
        if (!data || data.error) { setInvalid(true); return }
        setReport(data)
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false))
  }, [params.token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center">
          <BarChart3 className="h-8 w-8 text-sky-400 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-300 text-sm">Loading report…</p>
        </div>
      </div>
    )
  }

  if (invalid || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <Link2 className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-white mb-1">Link not available</h1>
          <p className="text-slate-400 text-sm">This report link is invalid or has expired. Please ask your agency for a new link.</p>
        </div>
      </div>
    )
  }

  const hasMeta = [report.meta_reach, report.meta_impressions, report.meta_clicks, report.meta_conversions, report.meta_spend, report.meta_roas, report.meta_revenue].some(v => v != null)
  const hasGoogle = [report.google_impressions, report.google_clicks, report.google_conversions, report.google_spend, report.google_roas, report.google_revenue].some(v => v != null)
  const hasSeo = [report.seo_offpage_count, report.seo_blog_count, report.seo_onpage_count].some(v => v != null && v > 0)
  const totalRevenue = (report.meta_revenue ?? 0) + (report.google_revenue ?? 0)
  const hasRevenue = report.meta_revenue != null || report.google_revenue != null

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="glass-card mb-6 p-6 text-center">
          <p className="text-xs uppercase tracking-widest text-sky-400 font-semibold mb-2">{report.agency_name} — Monthly Marketing Report</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">{report.client_company_name}</h1>
          <p className="text-slate-400 text-sm mt-1">{monthLabel(report.month)}</p>
        </div>

        {!hasMeta && !hasGoogle && !hasSeo && (
          <div className="glass-card p-8 text-center">
            <p className="text-slate-400 text-sm">No report data is available for this month yet.</p>
          </div>
        )}

        {hasSeo && (
          <MetricGrid
            title="SEO Performance"
            subtitle="Work completed this month"
            stats={[
              { label: 'Off-Page Links', value: fmtNum(report.seo_offpage_count) },
              { label: 'Blog Posts', value: fmtNum(report.seo_blog_count) },
              { label: 'OnPage URLs Optimized', value: fmtNum(report.seo_onpage_count) },
            ]}
          />
        )}

        {hasGoogle && (
          <MetricGrid
            title="Google Ads Performance"
            subtitle={report.google_period_start && report.google_period_end ? `${report.google_period_start} → ${report.google_period_end}` : undefined}
            stats={[
              { label: 'Impressions', value: fmtNum(report.google_impressions) },
              { label: 'Clicks', value: fmtNum(report.google_clicks) },
              { label: 'CTR', value: ctr(report.google_clicks, report.google_impressions) },
              { label: 'Conversions', value: fmtNum(report.google_conversions) },
              { label: 'Ad Spend', value: fmtMoney(report.google_spend) },
              { label: 'ROAS', value: report.google_roas != null ? `${report.google_roas}x` : '—' },
              ...(report.google_revenue != null ? [{ label: 'Revenue', value: fmtMoney(report.google_revenue) }] : []),
            ]}
          />
        )}

        {hasMeta && (
          <MetricGrid
            title="Meta Ads Performance"
            subtitle={report.meta_period_start && report.meta_period_end ? `${report.meta_period_start} → ${report.meta_period_end}` : undefined}
            stats={[
              { label: 'Reach', value: fmtNum(report.meta_reach) },
              { label: 'Impressions', value: fmtNum(report.meta_impressions) },
              { label: 'Clicks', value: fmtNum(report.meta_clicks) },
              { label: 'CTR', value: ctr(report.meta_clicks, report.meta_impressions) },
              { label: 'Conversions', value: fmtNum(report.meta_conversions) },
              { label: 'Ad Spend', value: fmtMoney(report.meta_spend) },
              { label: 'ROAS', value: report.meta_roas != null ? `${report.meta_roas}x` : '—' },
              ...(report.meta_revenue != null ? [{ label: 'Revenue', value: fmtMoney(report.meta_revenue) }] : []),
            ]}
          />
        )}

        {hasRevenue && (
          <div className="glass-card mb-4 p-6 text-center">
            <p className="text-sm font-medium text-slate-400 mb-1">Total Attributed Revenue</p>
            <p className="text-3xl font-bold text-emerald-400">{fmtMoney(totalRevenue)}</p>
          </div>
        )}

        {report.notes && (
          <div className="glass-card mb-4 p-5">
            <h2 className="font-semibold text-white mb-2">Notes from your team</h2>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{report.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs text-slate-500">Powered by <span className="text-slate-400 font-semibold">Stratiq</span></p>
        </div>
      </div>
    </div>
  )
}
