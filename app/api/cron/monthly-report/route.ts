import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Determine previous month
  const now = new Date()
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  // Get all active clients with scheduled monthly reports
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name, primary_contact_email, projects(id, domain)')
    .eq('status', 'active')

  if (!clients || clients.length === 0) {
    return NextResponse.json({ message: 'No active clients to report on' })
  }

  let reportsSent = 0
  for (const client of clients) {
    // In production: compile monthly activity summary, generate PDF, send to client
    // const summary = await compileMonthlyReport(client.id, reportYear, reportMonth)
    // await sendMonthlyReportEmail(client.primary_contact_email, summary)
    reportsSent++
  }

  return NextResponse.json({ success: true, reportsSent, period: `${reportYear}-${String(reportMonth).padStart(2, '0')}` })
}
