import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWeeklyTargetSummary } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Current week boundaries (Mon–Sun)
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.getFullYear(), now.getMonth(), diff)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const { data: targets, error: targetsError } = await supabase
    .from('activity_targets')
    .select(`
      *,
      project:projects(
        id,
        organization_id,
        project_team_assignments(
          user:users(id, email, full_name)
        )
      )
    `)
    .eq('year', year)
    .eq('month', month)

  if (targetsError) {
    return NextResponse.json({ error: targetsError.message }, { status: 500 })
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ message: 'No targets to process' })
  }

  const weeklyMultiplier = 0.25

  // Build per-user aggregated targets and actuals
  type SectionRow = { section: string; target: number; done: number }
  const userSummaries = new Map<string, { email: string; name: string; sections: Map<string, SectionRow> }>()

  for (const target of targets) {
    const project = (target as any).project
    if (!project) continue
    const projectId = project.id
    const assignments: any[] = project.project_team_assignments || []

    const [
      { count: socialCount },
      { count: offpageCount },
      { count: blogCount },
      { count: onpageCount },
      { count: groupCount },
    ] = await Promise.all([
      supabase.from('social_media_postings').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('submission_date', weekStartStr).lte('submission_date', weekEndStr),
      supabase.from('offpage_submissions').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('submission_date', weekStartStr).lte('submission_date', weekEndStr),
      supabase.from('blog_submissions').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('submission_date', weekStartStr).lte('submission_date', weekEndStr),
      supabase.from('onpage_details').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('created_at', weekStartStr).lte('created_at', weekEndStr),
      supabase.from('group_postings').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('submission_date', weekStartStr).lte('submission_date', weekEndStr),
    ])

    const projectRows: SectionRow[] = [
      { section: 'Social Media', target: Math.ceil(((target as any).social_media_target || 0) * weeklyMultiplier), done: socialCount ?? 0 },
      { section: 'Off-Page', target: Math.ceil(((target as any).offpage_target || 0) * weeklyMultiplier), done: offpageCount ?? 0 },
      { section: 'Blog', target: Math.ceil(((target as any).blog_target || 0) * weeklyMultiplier), done: blogCount ?? 0 },
      { section: 'On-Page', target: Math.ceil(((target as any).onpage_target || 0) * weeklyMultiplier), done: onpageCount ?? 0 },
      { section: 'Group Posting', target: Math.ceil(((target as any).group_posting_target || 0) * weeklyMultiplier), done: groupCount ?? 0 },
    ].filter(r => r.target > 0)

    for (const { user } of assignments) {
      if (!user?.email) continue

      const { data: prefs } = await supabase
        .from('user_notification_prefs')
        .select('weekly_target_email')
        .eq('user_id', user.id)
        .single()

      if (prefs && prefs.weekly_target_email === false) continue

      if (!userSummaries.has(user.id)) {
        userSummaries.set(user.id, { email: user.email, name: user.full_name || user.email, sections: new Map() })
      }
      const entry = userSummaries.get(user.id)!
      for (const row of projectRows) {
        const existing = entry.sections.get(row.section)
        if (existing) {
          existing.target += row.target
          existing.done += row.done
        } else {
          entry.sections.set(row.section, { ...row })
        }
      }
    }
  }

  let emailsSent = 0
  const errors: string[] = []

  for (const [, { email, name, sections }] of userSummaries) {
    const team_summary = Array.from(sections.values())
    try {
      await sendWeeklyTargetSummary(email, { name, team_summary })
      emailsSent++
    } catch (err: any) {
      errors.push(`${email}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    processed: targets.length,
    emailsSent,
    ...(errors.length > 0 && { errors }),
  })
}
