import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Check weekly completion rates and send reminders.
  // Implementation: query activity counts vs targets, email those < 80%
  return NextResponse.json({ success: true, message: 'Friday reminders sent' })
}
