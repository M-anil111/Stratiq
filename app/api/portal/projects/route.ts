import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get client record for this user
  const { data: portalAccess, error: accessError } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (accessError && accessError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to load portal access' }, { status: 500 })
  }

  if (!portalAccess) return NextResponse.json([])

  const { data, error: projectsError } = await supabase
    .from('projects')
    .select('id, domain, status, services, advertising_types, goals, created_at')
    .eq('client_id', portalAccess.client_id)
    .order('created_at', { ascending: false })

  if (projectsError) return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })

  const projects = data || []

  // Current month date range
  const now = new Date()
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2
  const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  // Fetch monthly stats for all projects in parallel
  const projectsWithStats = await Promise.all(
    projects.map(async (project) => {
      const [blogResult, offpageResult, onpageResult, socialResult] = await Promise.all([
        supabase
          .from('blog_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .gte('created_at', periodStart)
          .lt('created_at', periodEnd),
        supabase
          .from('offpage_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .gte('created_at', periodStart)
          .lt('created_at', periodEnd),
        supabase
          .from('onpage_details')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .gte('created_at', periodStart)
          .lt('created_at', periodEnd),
        supabase
          .from('social_media_postings')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .gte('created_at', periodStart)
          .lt('created_at', periodEnd),
      ])

      return {
        ...project,
        monthly_stats: {
          blog_count: blogResult.error?.code === '42P01' ? 0 : (blogResult.count ?? 0),
          offpage_count: offpageResult.error?.code === '42P01' ? 0 : (offpageResult.count ?? 0),
          onpage_count: onpageResult.error?.code === '42P01' ? 0 : (onpageResult.count ?? 0),
          social_count: socialResult.error?.code === '42P01' ? 0 : (socialResult.count ?? 0),
        },
      }
    })
  )

  return NextResponse.json(projectsWithStats)
}
