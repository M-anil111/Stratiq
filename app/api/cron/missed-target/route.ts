import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMissedTargetAlert } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Previous week boundaries (Mon–Sun)
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), diff)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)
  const weekStartStr = lastMonday.toISOString().split('T')[0]
  const weekEndStr = lastSunday.toISOString().split('T')[0]

  const { data: targets, error: targetsError } = await supabase
    .from('activity_targets')
    .select(`
      *,
      project:projects(
        id,
        organization_id,
        project_team_assignments(
          user:users(id, email, full_name, role)
        )
      )
    `)
    .eq('year', year)
    .eq('month', month)

  if (targetsError) {
    return NextResponse.json({ error: targetsError.message }, { status: 500 })
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ message: 'No targets to check', flagged: 0 })
  }

  type MissedEntry = { name: string; section: string; target: number; done: number; pct: number }
  const managerAlerts = new Map<string, { email: string; name: string; missed: MissedEntry[] }>()

  const weeklyMultiplier = 0.25

  for (const target of targets) {
    const project = (target as any).project
    if (!project) continue
    const projectId = project.id
    const orgId = project.organization_id
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

    const sections = [
      { section: 'Social Media', target: Math.ceil(((target as any).social_media_target || 0) * weeklyMultiplier), done: socialCount ?? 0 },
      { section: 'Off-Page', target: Math.ceil(((target as any).offpage_target || 0) * weeklyMultiplier), done: offpageCount ?? 0 },
      { section: 'Blog', target: Math.ceil(((target as any).blog_target || 0) * weeklyMultiplier), done: blogCount ?? 0 },
      { section: 'On-Page', target: Math.ceil(((target as any).onpage_target || 0) * weeklyMultiplier), done: onpageCount ?? 0 },
      { section: 'Group Posting', target: Math.ceil(((target as any).group_posting_target || 0) * weeklyMultiplier), done: groupCount ?? 0 },
    ].filter(s => s.target > 0)

    for (const { user } of assignments) {
      if (!user?.email) continue

      const missedSections: MissedEntry[] = sections
        .map(s => ({ ...s, pct: Math.round((s.done / s.target) * 100) }))
        .filter(s => s.pct < 60)
        .map(s => ({ name: user.full_name || user.email, section: s.section, target: s.target, done: s.done, pct: s.pct }))

      if (missedSections.length === 0) continue

      const { data: managers } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('organization_id', orgId)
        .in('role', ['admin', 'manager', 'super_admin'])

      for (const manager of managers || []) {
        if (!manager.email) continue

        const { data: prefs } = await supabase
          .from('user_notification_prefs')
          .select('missed_target_email')
          .eq('user_id', manager.id)
          .single()

        if (prefs && prefs.missed_target_email === false) continue

        if (!managerAlerts.has(manager.id)) {
          managerAlerts.set(manager.id, { email: manager.email, name: manager.full_name || manager.email, missed: [] })
        }
        managerAlerts.get(manager.id)!.missed.push(...missedSections)
      }
    }
  }

  let alertsSent = 0
  const errors: string[] = []

  for (const [, { email, name, missed }] of Array.from(managerAlerts)) {
    try {
      await sendMissedTargetAlert(email, { name, missed })
      alertsSent++
    } catch (err: any) {
      errors.push(`${email}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    flagged: managerAlerts.size,
    alertsSent,
    ...(errors.length > 0 && { errors }),
    message: 'Missed target check complete',
  })
}
