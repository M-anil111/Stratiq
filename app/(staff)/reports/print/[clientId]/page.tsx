'use client'
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, Printer } from 'lucide-react'

interface Report {
  google_impressions: number | null
  google_clicks: number | null
  google_conversions: number | null
  google_spend: number | null
  google_roas: number | null
  google_revenue: number | null
  google_reach: number | null
  meta_reach: number | null
  meta_impressions: number | null
  meta_clicks: number | null
  meta_conversions: number | null
  meta_spend: number | null
  meta_roas: number | null
  meta_revenue: number | null
  seo_offpage_count: number | null
  seo_blog_count: number | null
  seo_onpage_count: number | null
  notes: string | null
  prev?: Record<string, any> | null
}

interface Company {
  name?: string
  logo_url?: string
  brand_color?: string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Metrics where a decrease is a good thing (cost-type metrics)
const DOWN_IS_GOOD = new Set(['google_spend', 'meta_spend'])

function num(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}
function money(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function ctr(clicks: number | null | undefined, impressions: number | null | undefined) {
  if (clicks && impressions) return ((clicks / impressions) * 100).toFixed(2) + '%'
  return '—'
}

function Delta({ field, current, prev }: { field: string; current: any; prev: any }) {
  if (current == null || prev == null || typeof current !== 'number' || typeof prev !== 'number' || prev === 0) return null
  const pct = ((current - prev) / Math.abs(prev)) * 100
  if (!isFinite(pct) || pct === 0) return null
  const up = pct > 0
  const good = DOWN_IS_GOOD.has(field) ? !up : up
  return (
    <span className="ml-1.5 text-[11px] font-semibold" style={{ color: good ? '#059669' : '#dc2626' }} title="vs previous month">
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function MarketingReportPrintPage() {
  const params = useParams<{ clientId: string }>()
  const searchParams = useSearchParams()
  const now = new Date()
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [report, setReport] = useState<Report | null>(null)
  const [company, setCompany] = useState<Company>({})
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.clientId) return
    Promise.all([
      fetch(`/api/clients/${params.clientId}/reports?month=${monthParam}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/settings/company').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/api/clients').then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([rep, co, cl]) => {
        if (rep && !rep.error) {
          const r = Array.isArray(rep) ? rep[0] : rep
          setReport(r || null)
        }
        setCompany(co || {})
        const clients = cl?.clients || (Array.isArray(cl) ? cl : [])
        const found = clients.find((c: any) => c.id === params.clientId)
        if (found) setClientName(found.company_name)
      })
      .finally(() => setLoading(false))
  }, [params?.clientId, monthParam])

  const [yearStr, monthStr] = monthParam.split('-')
  const monthLabel = `${MONTHS[parseInt(monthStr) - 1] ?? ''} ${yearStr}`
  const brand = company.brand_color || '#0f172a'
  const prev = report?.prev

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-600 dark:text-slate-400 text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading report…
      </div>
    )
  }

  const hasMeta = report && [report.meta_impressions, report.meta_clicks, report.meta_spend, report.meta_conversions, report.meta_reach, report.meta_roas, report.meta_revenue].some(v => v != null)
  const hasGoogle = report && [report.google_impressions, report.google_clicks, report.google_spend, report.google_conversions, report.google_roas, report.google_revenue].some(v => v != null)
  const hasSeo = report && [report.seo_offpage_count, report.seo_blog_count, report.seo_onpage_count].some(v => v != null && v !== 0)
  const totalRevenue = (report?.meta_revenue ?? 0) + (report?.google_revenue ?? 0)
  const totalSpend = (report?.meta_spend ?? 0) + (report?.google_spend ?? 0)
  const hasRevenue = report && (report.meta_revenue != null || report.google_revenue != null)
  const hasAnyData = hasMeta || hasGoogle || hasSeo || hasRevenue || (report?.notes)

  const metricRow = (label: string, field: string, value: string) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900 tabular-nums">
        {value}
        {prev && <Delta field={field} current={(report as any)?.[field]} prev={(prev as any)?.[field]} />}
      </span>
    </div>
  )

  return (
    <div className="report-print-root p-4 lg:p-8">
      <style>{`
        @media print {
          aside, nav, header, [class*="glass-sidebar"] { display: none !important; }
          body, html { background: #fff !important; }
          .bg-mesh { background: #fff !important; }
          .lg\\:ml-20 { margin-left: 0 !important; }
          .print-hide { display: none !important; }
          .report-print-root { padding: 0 !important; }
          .report-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="print-hide flex items-center justify-between max-w-[820px] mx-auto mb-4">
        <p className="text-slate-600 dark:text-slate-400 text-sm">Print preview — {clientName || 'Marketing report'} · {monthLabel}</p>
        <button onClick={() => window.print()} className="btn-brand flex items-center gap-1.5 px-4 py-2.5 text-sm">
          <Printer className="h-4 w-4" /> Download PDF
        </button>
      </div>

      <div className="report-sheet bg-white text-gray-900 rounded-xl shadow-xl max-w-[820px] mx-auto p-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-10 pb-6" style={{ borderBottom: `3px solid ${brand}` }}>
          <div className="flex items-center gap-4">
            {company.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt={company.name || 'Logo'} className="h-14 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{company.name || 'Marketing Report'}</h1>
              <p className="text-sm text-gray-500">Marketing Report</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-gray-900">{clientName || '—'}</p>
            <p className="text-sm text-gray-500 mt-1">{monthLabel}</p>
          </div>
        </div>

        {!hasAnyData ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-base font-medium">No report data for {monthLabel}</p>
            <p className="text-sm mt-1">There is nothing recorded for this client in this period.</p>
          </div>
        ) : (
          <>
            {/* Meta Ads */}
            {hasMeta && (
              <section className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: brand }}>Meta Ads</h2>
                {metricRow('Impressions', 'meta_impressions', num(report!.meta_impressions))}
                {metricRow('Clicks', 'meta_clicks', num(report!.meta_clicks))}
                {metricRow('CTR', 'meta_ctr', ctr(report!.meta_clicks, report!.meta_impressions))}
                {metricRow('Reach', 'meta_reach', num(report!.meta_reach))}
                {metricRow('Conversions', 'meta_conversions', num(report!.meta_conversions))}
                {metricRow('Ad Spend', 'meta_spend', money(report!.meta_spend))}
                {metricRow('ROAS', 'meta_roas', report!.meta_roas != null ? `${report!.meta_roas}x` : '—')}
                {metricRow('Revenue', 'meta_revenue', money(report!.meta_revenue))}
              </section>
            )}

            {/* Google Ads */}
            {hasGoogle && (
              <section className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: brand }}>Google Ads</h2>
                {metricRow('Impressions', 'google_impressions', num(report!.google_impressions))}
                {metricRow('Clicks', 'google_clicks', num(report!.google_clicks))}
                {metricRow('CTR', 'google_ctr', ctr(report!.google_clicks, report!.google_impressions))}
                {metricRow('Conversions', 'google_conversions', num(report!.google_conversions))}
                {metricRow('Ad Spend', 'google_spend', money(report!.google_spend))}
                {metricRow('ROAS', 'google_roas', report!.google_roas != null ? `${report!.google_roas}x` : '—')}
                {metricRow('Revenue', 'google_revenue', money(report!.google_revenue))}
              </section>
            )}

            {/* SEO Summary */}
            {hasSeo && (
              <section className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: brand }}>SEO Summary</h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Off-Page Links', value: report!.seo_offpage_count },
                    { label: 'Blog Posts', value: report!.seo_blog_count },
                    { label: 'On-Page URLs', value: report!.seo_onpage_count },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg border border-gray-200 p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{num(s.value)}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Revenue Overview */}
            {hasRevenue && (
              <section className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: brand }}>Revenue Overview</h2>
                {metricRow('Meta Revenue', 'meta_revenue', money(report!.meta_revenue))}
                {metricRow('Google Revenue', 'google_revenue', money(report!.google_revenue))}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total Ad Spend</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{money(totalSpend)}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 mt-1" style={{ borderTop: `2px solid ${brand}` }}>
                  <span className="text-sm font-bold text-gray-900">Total Revenue</span>
                  <span className="text-base font-bold text-gray-900 tabular-nums">{money(totalRevenue)}</span>
                </div>
              </section>
            )}

            {/* Notes */}
            {report?.notes && (
              <section className="mb-2 border-t border-gray-200 pt-4">
                <h2 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: brand }}>Notes</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</p>
              </section>
            )}
          </>
        )}

        <p className="text-xs text-gray-400 mt-10 text-center">
          {company.name ? `Prepared by ${company.name}` : 'Marketing report'} · {monthLabel}
        </p>
      </div>
    </div>
  )
}
