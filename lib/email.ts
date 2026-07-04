export { sendEmail } from '@/lib/email/index'
import { sendEmail } from '@/lib/email/index'
import { generateFridayReminderEmail } from '@/lib/email/templates/friday-reminder'
import { generateMissedTargetEmail } from '@/lib/email/templates/missed-target'
import { generateMonthlyReportEmail } from '@/lib/email/templates/monthly-report'
import { generateWeeklyTargetEmail } from '@/lib/email/templates/weekly-target'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.stratiq.app'

export async function sendFridayReminder(
  to: string,
  data: {
    name: string
    pending_items: Array<{ section: string; remaining: number }>
  }
) {
  const today = new Date()
  const deadlineDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const { subject, html } = generateFridayReminderEmail({
    userName: data.name,
    incompleteItems: data.pending_items,
    deadlineDate,
    dashboardUrl: `${BASE_URL}/dashboard`,
  })
  return sendEmail({ to, subject, html })
}

export async function sendMissedTargetAlert(
  to: string,
  data: {
    name: string
    missed: Array<{ name: string; section: string; target: number; done: number; pct: number }>
  }
) {
  const weekOf = getWeekOf()
  const { subject, html } = generateMissedTargetEmail({
    managerName: data.name,
    weekOf,
    members: data.missed,
    dashboardUrl: `${BASE_URL}/team`,
  })
  return sendEmail({ to, subject, html })
}

export async function sendMonthlyReport(
  to: string,
  data: {
    client_name: string
    report_url: string
    month?: string
    seo?: { offpageLinks: number; blogPosts: number; socialPosts: number }
  }
) {
  const now = new Date()
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthLabel =
    data.month ||
    new Date(reportYear, reportMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const { subject, html } = generateMonthlyReportEmail({
    clientName: data.client_name,
    month: monthLabel,
    seo: data.seo,
    reportUrl: data.report_url,
  })
  return sendEmail({ to, subject, html })
}

export async function sendWeeklyTargetSummary(
  to: string,
  data: {
    name: string
    team_summary: Array<{ section: string; target: number; done: number }>
  }
) {
  const weekOf = getWeekOf()
  const { subject, html } = generateWeeklyTargetEmail({
    userName: data.name,
    weekOf,
    targets: data.team_summary,
    dashboardUrl: `${BASE_URL}/dashboard`,
  })
  return sendEmail({ to, subject, html })
}

function getWeekOf(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
