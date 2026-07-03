interface MonthlyReportData {
  clientName: string
  month: string
  googleAds?: { impressions: number; clicks: number; conversions: number; spend: number; roas?: number }
  metaAds?: { impressions: number; clicks: number; spend: number; conversions?: number; roas?: number }
  seo?: { offpageLinks: number; blogPosts: number; socialPosts: number }
  reportUrl: string
}

export function generateMonthlyReportEmail(data: MonthlyReportData): { subject: string; html: string } {
  const subject = `Your ${data.month} Marketing Report — ${data.clientName}`

  const googleSection = data.googleAds ? `
    <h3 style="margin:16px 0 8px;font-size:14px;color:#374151">Google Ads</h3>
    <table style="width:100%;border-collapse:collapse">
      ${[
        ['Impressions', data.googleAds.impressions.toLocaleString()],
        ['Clicks', data.googleAds.clicks.toLocaleString()],
        ['Conversions', data.googleAds.conversions.toLocaleString()],
        ['Ad Spend', `$${data.googleAds.spend.toFixed(2)}`],
        ...(data.googleAds.roas ? [['ROAS', `${data.googleAds.roas.toFixed(2)}x`]] : []),
      ].map(([label, val]) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">${label}</td><td style="padding:6px 0;font-weight:600;color:#111827;font-size:13px;text-align:right">${val}</td></tr>`).join('')}
    </table>` : ''

  const metaSection = data.metaAds ? `
    <h3 style="margin:16px 0 8px;font-size:14px;color:#374151">Meta Ads</h3>
    <table style="width:100%;border-collapse:collapse">
      ${[
        ['Impressions', data.metaAds.impressions.toLocaleString()],
        ['Clicks', data.metaAds.clicks.toLocaleString()],
        ['Ad Spend', `$${data.metaAds.spend.toFixed(2)}`],
        ...(data.metaAds.conversions ? [['Conversions', data.metaAds.conversions.toLocaleString()]] : []),
        ...(data.metaAds.roas ? [['ROAS', `${data.metaAds.roas.toFixed(2)}x`]] : []),
      ].map(([label, val]) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">${label}</td><td style="padding:6px 0;font-weight:600;color:#111827;font-size:13px;text-align:right">${val}</td></tr>`).join('')}
    </table>` : ''

  const seoSection = data.seo ? `
    <h3 style="margin:16px 0 8px;font-size:14px;color:#374151">SEO Activities</h3>
    <table style="width:100%;border-collapse:collapse">
      ${[
        ['Off-Page Links Built', data.seo.offpageLinks],
        ['Blog Posts Published', data.seo.blogPosts],
        ['Social Media Posts', data.seo.socialPosts],
      ].map(([label, val]) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">${label}</td><td style="padding:6px 0;font-weight:600;color:#111827;font-size:13px;text-align:right">${val}</td></tr>`).join('')}
    </table>` : ''

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0F172A;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Stratiq</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Monthly Performance Report</p>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#111827">${data.clientName}</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px">${data.month} Summary</p>
      ${googleSection}${metaSection}${seoSection}
      <div style="margin-top:28px">
        <a href="${data.reportUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">View Full Report →</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">Stratiq by Mindshare Consulting Inc.</p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
