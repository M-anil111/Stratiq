import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const orgId = userData.organization_id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  const [clientsRes, projectsRes, socialRes, offpageRes, blogRes, onpageRes, groupRes, targetsRes] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('social_media_postings').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd),
    supabase.from('offpage_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd),
    supabase.from('blog_submissions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd),
    supabase.from('onpage_details').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', monthStart).lte('created_at', monthEnd),
    supabase.from('group_postings').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('submission_date', monthStart).lte('submission_date', monthEnd),
    supabase.from('activity_targets').select('social_target,offpage_target,blog_target').eq('organization_id', orgId).eq('month', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`),
  ])

  const totalActivities = (socialRes.count || 0) + (offpageRes.count || 0) + (blogRes.count || 0) + (onpageRes.count || 0) + (groupRes.count || 0)

  let targetsHitPct = 0
  if (targetsRes.data?.length) {
    const targets = targetsRes.data
    const totalTarget = targets.reduce((s, t) => s + (t.social_target || 0) + (t.offpage_target || 0) + (t.blog_target || 0), 0)
    if (totalTarget > 0) {
      targetsHitPct = Math.round(Math.min((totalActivities / totalTarget) * 100, 100))
    }
  }

  return NextResponse.json({
    total_clients: clientsRes.count || 0,
    active_projects: projectsRes.count || 0,
    activities_this_month: totalActivities,
    targets_hit_pct: targetsHitPct,
  })
}

