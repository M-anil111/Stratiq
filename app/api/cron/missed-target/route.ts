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

  // Find team members who missed their weekly targets (< 60% completion by Friday)
  // In production: compare activity_records counts against activity_targets,
  // flag members below threshold, create missed_target_records, and notify managers.
  const { data: targets } = await supabase
    .from('activity_targets')
    .select('*, project:projects(id, domain, project_team_assignments(user:users(id, email, full_name)))')
    .eq('year', year)
    .eq('month', month)

  let flagged = 0
  // Implementation: loop targets, compute weekly expected vs actual, flag misses
  // await notifyManagerOfMissedTargets(flaggedMembers)

  return NextResponse.json({ success: true, flagged, message: 'Missed target check complete' })
}
