import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/index'
import { buildReportEmailHtml, buildReportEmailSubject } from '@/lib/report-email'
import { notifyOrgManagers } from '@/lib/notify'

// Runs monthly (see vercel.json). For each org, for each active client with a
// marketing_reports row for the month that just ended, email the report to the
// client's recipient and link to the branded print report page.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stratiqnow.com'
  const now = new Date()

  // Previous month (the month just ended)
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthKey = `${reportYear}-${String(reportMonth).padStart(2, '0')}` // YYYY-MM
  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Period bounds for SEO submission counts
  const periodStart = `${monthKey}-01`
  const nextMonth = reportMonth === 12 ? 1 : reportMonth + 1
  const nextYear = reportMonth === 12 ? reportYear + 1 : reportYear
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  let orgs = 0
  let sent = 0
  let skipped = 0
  const errors: string[] = []

  // Fetch all reports for the target month, grouped by org
  const { data: reports, error: reportsError } = await supabase
    .from('marketing_reports')
    .select('*')
    .eq('year', reportYear)
    .eq('month', reportMonth)

  if (reportsError) {
    // Missing table → nothing to do
    if ((reportsError as any).code === '42P01') {
      return NextResponse.json({ orgs: 0, sent: 0, skipped: 0, errors: [] })
    }
    return NextResponse.json({ error: reportsError.message }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({ orgs: 0, sent: 0, skipped: 0, errors: [] })
  }

  // Group reports by organization
  const byOrg = new Map<string, any[]>()
  for (const r of reports) {
    const oid = (r as any).organization_id
    if (!oid) continue
    if (!byOrg.has(oid)) byOrg.set(oid, [])
    byOrg.get(oid)!.push(r)
  }

  for (const [orgId, orgReports] of Array.from(byOrg.entries())) {
    orgs++
    try {
      // Agency name for this org
      let agencyName = 'Your Agency'
      try {
        const { data: orgRow } = await supabase
          .from('organization_settings')
          .select('value')
          .eq('organization_id', orgId)
          .eq('key', 'company_name')
          .single()
        if (orgRow?.value) agencyName = orgRow.value
      } catch {
        // ignore — fall back to default
      }

      for (const report of orgReports) {
        const clientId = (report as any).client_id
        try {
          // Resolve client + ensure active + has recipient
          const { data: client } = await supabase
            .from('clients')
            .select('id, company_name, email, project_status')
            .eq('id', clientId)
            .eq('organization_id', orgId)
            .single()

          if (!client || client.project_status !== 'active') {
            skipped++
            continue
          }

          const toEmail = client.email
          if (!toEmail) {
            skipped++
            continue
          }

          // Aggregate SEO counts across this client's projects
          let seoOffpage = 0
          let seoBlog = 0
          let seoOnpage = 0
          try {
            const { data: projects } = await supabase
              .from('projects')
              .select('id')
              .eq('client_id', clientId)
              .eq('organization_id', orgId)
            const projectIds = (projects || []).map((p: any) => p.id)
            if (projectIds.length > 0) {
              const [offpageRes, blogRes, onpageRes] = await Promise.all([
                supabase.from('offpage_submissions').select('id', { count: 'exact', head: true })
                  .in('project_id', projectIds).eq('client_report', true).gte('created_at', periodStart).lt('created_at', periodEnd),
                supabase.from('blog_submissions').select('id', { count: 'exact', head: true })
                  .in('project_id', projectIds).eq('client_report', true).gte('created_at', periodStart).lt('created_at', periodEnd),
                supabase.from('onpage_details').select('id', { count: 'exact', head: true })
                  .in('project_id', projectIds).gte('created_at', periodStart).lt('created_at', periodEnd),
              ])
              seoOffpage = offpageRes.count ?? 0
              seoBlog = blogRes.count ?? 0
              seoOnpage = onpageRes.count ?? 0
            }
          } catch {
            // Missing SEO tables → leave counts at zero
          }

          const html = buildReportEmailHtml({
            clientName: client.company_name,
            agencyName,
            monthLabel,
            reportUrl: `${appUrl}/reports/print/${clientId}?month=${monthKey}`,
            google: (report as any).google_ads_data || {},
            meta: (report as any).meta_ads_data || {},
            seo: { offpage: seoOffpage, blog: seoBlog, onpage: seoOnpage },
            notes: (report as any).notes,
          })

          await sendEmail({
            to: toEmail,
            subject: buildReportEmailSubject(client.company_name, monthLabel),
            html,
          })
          sent++

          // Mark as sent
          await supabase
            .from('marketing_reports')
            .update({ is_sent_to_client: true, sent_at: new Date().toISOString() })
            .eq('client_id', clientId)
            .eq('organization_id', orgId)
            .eq('year', reportYear)
            .eq('month', reportMonth)

          // Best-effort notify internal staff that the report auto-sent.
          try {
            await notifyOrgManagers(supabase, orgId, {
              type: 'report',
              severity: 'success',
              title: 'Monthly report sent',
              body: `Monthly report for ${client.company_name} was sent automatically`,
              link: `/clients/${clientId}/reports`,
              entityType: 'client',
              entityId: clientId,
            })
          } catch {
            // non-fatal
          }
        } catch (err: any) {
          errors.push(`client ${clientId}: ${err?.message || 'unknown error'}`)
        }
      }
    } catch (err: any) {
      errors.push(`org ${orgId}: ${err?.message || 'unknown error'}`)
    }
  }

  return NextResponse.json({ orgs, sent, skipped, errors })
}
