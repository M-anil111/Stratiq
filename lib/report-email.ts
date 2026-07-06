// Shared marketing-report email composition used by the monthly cron.
// Mirrors the branded HTML in app/api/clients/[id]/reports/send/route.ts,
// adds SEO counts, revenue, and a link to the branded print report page.

export interface ReportEmailInput {
  clientName: string
  agencyName: string
  monthLabel: string
  reportUrl: string
  google?: Record<string, any> | null
  meta?: Record<string, any> | null
  seo?: { offpage?: number | null; blog?: number | null; onpage?: number | null } | null
  notes?: string | null
}

const fmt = (v: any, prefix = '') => (v != null ? `${prefix}${Number(v).toLocaleString()}` : '—')

export function buildReportEmailSubject(clientName: string, monthLabel: string) {
  return `${clientName} — ${monthLabel} Marketing Report`
}

export function buildReportEmailHtml(input: ReportEmailInput): string {
  const { clientName, agencyName, monthLabel, reportUrl } = input
  const g = input.google || {}
  const m = input.meta || {}
  const seo = input.seo || {}
  const hasSeo = [seo.offpage, seo.blog, seo.onpage].some((v) => v != null && v !== 0)

  return `
    <div style="font-family:Inter,sans-serif;max-width:680px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:28px 32px">
        <h1 style="margin:0 0 6px;font-size:24px;color:#fff">${clientName} — Monthly Report</h1>
        <p style="margin:0;color:rgba(255,255,255,0.8);font-size:15px">${monthLabel} · Prepared by ${agencyName}</p>
      </div>
      <div style="padding:32px">
        ${g.impressions != null ? `
        <h2 style="color:#38bdf8;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 16px">Google Ads</h2>
        <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:28px">
          <tbody>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Impressions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.impressions)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Clicks</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.clicks)}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Conversions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.conversions)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Spend</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.spend, '$')}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Revenue</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.revenue, '$')}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">ROAS</td><td style="padding:12px 16px;color:#38bdf8;font-weight:700;text-align:right">${g.roas != null ? Number(g.roas).toFixed(2) + 'x' : '—'}</td></tr>
          </tbody>
        </table>` : ''}
        ${m.impressions != null ? `
        <h2 style="color:#a78bfa;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 16px">Meta Ads</h2>
        <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:28px">
          <tbody>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Reach</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.reach)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Impressions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.impressions)}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Clicks</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.clicks)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Conversions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.conversions)}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Spend</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.spend, '$')}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Revenue</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.revenue, '$')}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">ROAS</td><td style="padding:12px 16px;color:#a78bfa;font-weight:700;text-align:right">${m.roas != null ? Number(m.roas).toFixed(2) + 'x' : '—'}</td></tr>
          </tbody>
        </table>` : ''}
        ${hasSeo ? `
        <h2 style="color:#34d399;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 16px">SEO Summary</h2>
        <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:28px">
          <tbody>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Off-Page Links</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(seo.offpage)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Blog Posts</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(seo.blog)}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">On-Page URLs</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(seo.onpage)}</td></tr>
          </tbody>
        </table>` : ''}
        ${input.notes ? `<p style="color:#94a3b8;font-size:14px;border-left:3px solid #334155;padding-left:12px;margin:0 0 28px">${input.notes}</p>` : ''}
        <div style="text-align:center;margin:0 0 28px">
          <a href="${reportUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px">View Full Report</a>
        </div>
        <p style="color:#64748b;font-size:13px;margin:28px 0 0">This report was generated by ${agencyName}. For questions, reply to this email.</p>
      </div>
    </div>
  `
}
