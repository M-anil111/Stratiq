import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Org-wide feed of scheduled / recent social posts for the top-level Social tool.
// Joins project → client so each post can show the client company for context.
// Degrades gracefully (42P01 → __unavailable) before the postings migration runs.

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Optional date range (for the calendar). When provided, return every post whose
  // scheduled_date falls in [start, end); otherwise fall back to the recent/upcoming feed.
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const hasRange = Boolean(start && end)

  // Try the richest join first; fall back to bare rows if the relationship or
  // columns aren't present yet.
  const selects = [
    'id, platform, post_content, media_url, scheduled_date, submission_date, live_link, comment, status, project_id, project:projects!project_id(id, name, domain, client:clients!client_id(company_name))',
    'id, platform, post_content, media_url, scheduled_date, submission_date, live_link, comment, status, project_id',
    '*',
  ]

  let data: any[] | null = null
  let error: any = null
  for (const sel of selects) {
    let query = supabase
      .from('social_media_postings')
      .select(sel)
      .eq('organization_id', userData.organization_id)
    if (hasRange) {
      query = query
        .gte('scheduled_date', start as string)
        .lt('scheduled_date', end as string)
        .order('scheduled_date', { ascending: true, nullsFirst: false })
    } else {
      query = query
        .order('scheduled_date', { ascending: false, nullsFirst: false })
        .limit(100)
    }
    const res = await query
    data = res.data as any[] | null
    error = res.error
    if (!error) break
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    if (!/Could not find|does not exist|schema cache|relationship/i.test(error.message || '')) break
  }

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const posts = (data || []).map((p: any) => ({
    id: p.id,
    platform: p.platform,
    post_content: p.post_content,
    media_url: p.media_url,
    scheduled_date: p.scheduled_date,
    submission_date: p.submission_date,
    live_link: p.live_link,
    comment: p.comment,
    status: p.status,
    project_id: p.project_id,
    project_name: p.project?.name || p.project?.domain || null,
    client_name: p.project?.client?.company_name || null,
  }))

  return NextResponse.json({ posts })
}
