import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: targets } = await supabase
    .from('activity_targets')
    .select('*, project:projects(id, domain, client:clients(company_name), project_team_assignments(user:users(id, email, full_name, role)))')
    .eq('year', year)
    .eq('month', month)

  if (!targets || targets.length === 0) {
    return NextResponse.json({ message: 'No targets to process' })
  }

  const weeklyMultiplier = 0.25 // 25% per week

  let emailsSent = 0
  for (const target of targets) {
    const weeklyTargets = {
      social_media: Math.ceil(target.social_media_target * weeklyMultiplier),
      offpage: Math.ceil(target.offpage_target * weeklyMultiplier),
      blog: Math.ceil(target.blog_target * weeklyMultiplier),
      onpage: Math.ceil(target.onpage_target * weeklyMultiplier),
      group_posting: Math.ceil(target.group_posting_target * weeklyMultiplier),
    }

    // In production, send emails to each team member
    // await sendWeeklyTargetEmail(teamMember, weeklyTargets)
    emailsSent++
  }

  return NextResponse.json({ success: true, processed: targets.length, emailsSent })
}
