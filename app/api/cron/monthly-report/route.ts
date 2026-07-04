import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMonthlyReport } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // Previous month
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthStart = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`
  const lastDay = new Date(reportYear, reportMonth, 0).getDate()
  const monthEnd = `${reportYear}-${String(reportMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, company_name, primary_contact_email, projects(id, domain)')
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ message: 'No active clients to report on' })
  }

  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.stratiq.app'
  let reportsSent = 0
  const errors: string[] = []

  for (const client of clients) {
    if (!client.primary_contact_email) continue

    const orgId = (client as any).organization_id
    const projects: any[] = (client as any).projects || []

    // Aggregate SEO activities across all client projects for the month
    let offpageLinks = 0
    let blogPosts = 0
    let socialPosts = 0

    for (const project of projects) {
      const [
        { count: offpage },
        { count: blog },
        { count: social },
      ] = await Promise.all([
        supabase.from('offpage_submissions').select('id', { count: 'exact', head: true })
          .eq('project_id', project.id).gte('submission_date', monthStart).lte('submission_date', monthEnd),
        supabase.from('blog_submissions').select('id', { count: 'exact', head: true })
          .eq('project_id', project.id).gte('submission_date', monthStart).lte('submission_date', monthEnd),
        supabase.from('social_media_postings').select('id', { count: 'exact', head: true })
          .eq('project_id', project.id).gte('submission_date', monthStart).lte('submission_date', monthEnd),
      ])
      offpageLinks += offpage ?? 0
      blogPosts += blog ?? 0
      socialPosts += social ?? 0
    }

    const reportUrl = `${BASE_URL}/client-portal`

    try {
      await sendMonthlyReport(client.primary_contact_email, {
        client_name: client.company_name,
        report_url: reportUrl,
        month: monthLabel,
        seo: { offpageLinks, blogPosts, socialPosts },
      })
      reportsSent++
    } catch (err: any) {
      errors.push(`${client.company_name}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    reportsSent,
    period: `${reportYear}-${String(reportMonth).padStart(2, '0')}`,
    ...(errors.length > 0 && { errors }),
  })
}
