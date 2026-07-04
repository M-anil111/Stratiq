import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendFridayReminder } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Week boundaries (Mon–Sun)
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
    return NextResponse.json({ message: 'No targets found', remindersSent: 0 })
  }

  // Build per-user pending items across all their projects
  const userPendingMap = new Map<string, { email: string; name: string; pending: Array<{ section: string; remaining: number }> }>()

  for (const target of targets) {
    const project = (target as any).project
    if (!project) continue
    const projectId = project.id

    const weeklyMultiplier = 0.25
    const weeklyTargets: Record<string, number> = {
      'Social Media': Math.ceil(((target as any).social_media_target || 0) * weeklyMultiplier),
      'Off-Page': Math.ceil(((target as any).offpage_target || 0) * weeklyMultiplier),
      'Blog': Math.ceil(((target as any).blog_target || 0) * weeklyMultiplier),
      'On-Page': Math.ceil(((target as any).onpage_target || 0) * weeklyMultiplier),
      'Group Posting': Math.ceil(((target as any).group_posting_target || 0) * weeklyMultiplier),
    }

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

    const actuals: Record<string, number> = {
      'Social Media': socialCount ?? 0,
      'Off-Page': offpageCount ?? 0,
      'Blog': blogCount ?? 0,
      'On-Page': onpageCount ?? 0,
      'Group Posting': groupCount ?? 0,
    }

    const pendingItems = Object.entries(weeklyTargets)
      .filter(([section, t]) => t > 0 && actuals[section] < t)
      .map(([section, t]) => ({ section, remaining: t - actuals[section] }))

    if (pendingItems.length === 0) continue

    const assignments: any[] = project.project_team_assignments || []
    for (const { user } of assignments) {
      if (!user?.email) continue

      const { data: prefs } = await supabase
        .from('user_notification_prefs')
        .select('friday_reminder_email')
        .eq('user_id', user.id)
        .single()

      if (prefs && prefs.friday_reminder_email === false) continue

      if (!userPendingMap.has(user.id)) {
        userPendingMap.set(user.id, { email: user.email, name: user.full_name || user.email, pending: [] })
      }
      const entry = userPendingMap.get(user.id)!
      for (const item of pendingItems) {
        const existing = entry.pending.find(p => p.section === item.section)
        if (existing) {
          existing.remaining += item.remaining
        } else {
          entry.pending.push({ ...item })
        }
      }
    }
  }

  let remindersSent = 0
  const errors: string[] = []

  for (const [, { email, name, pending }] of Array.from(userPendingMap)) {
    try {
      await sendFridayReminder(email, { name, pending_items: pending })
      remindersSent++
    } catch (err: any) {
      errors.push(`${email}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    remindersSent,
    ...(errors.length > 0 && { errors }),
    message: `Friday reminders sent to ${remindersSent} team member(s)`,
  })
}
