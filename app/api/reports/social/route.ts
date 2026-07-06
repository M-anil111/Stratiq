import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// HubSpot-style social "Analyze" report. Org-scoped aggregate of published/live
// posts, joined project → client for the company name. Engagement columns
// (likes/comments/shares/views) may not exist yet — we probe for them and
// degrade to zeros if the DB doesn't have them. 42P01 → __unavailable.

const ENGAGEMENT_FIELDS = ['likes', 'comments', 'shares', 'views'] as const

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const months = Math.max(1, Math.min(24, parseInt(searchParams.get('months') || '3') || 3))
  const platformFilter = searchParams.get('platform')
  const clientFilter = searchParams.get('client_id')

  const since = new Date()
  since.setMonth(since.getMonth() - months)
  since.setHours(0, 0, 0, 0)
  const sinceStr = since.toISOString().slice(0, 10)

  // Progressive selects: richest (with engagement + join) first, degrade as
  // columns / relationships turn out to be missing.
  const base = 'id, platform, post_content, status, scheduled_date, submission_date, live_link, project_id'
  const engagementCols = ENGAGEMENT_FIELDS.join(', ')
  const join = 'project:projects!project_id(id, name, domain, client_id, client:clients!client_id(company_name))'
  const selects = [
    `${base}, ${engagementCols}, ${join}`,
    `${base}, ${join}`,
    `${base}`,
    '*',
  ]

  let data: any[] | null = null
  let error: any = null
  for (const sel of selects) {
    let query = supabase
      .from('social_media_postings')
      .select(sel)
      .eq('organization_id', userData.organization_id)
      .in('status', ['live'])
    // Range filter on scheduled_date, but keep rows without one via submission_date fallback is
    // not possible in a single or() cleanly with dates, so filter on scheduled_date when present.
    query = query.gte('scheduled_date', sinceStr)
    if (platformFilter && platformFilter !== 'all') query = query.eq('platform', platformFilter)

    const res = await query.limit(2000)
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

  const rows = data || []
  const num = (v: any) => (typeof v === 'number' ? v : Number(v)) || 0

  // Filter by client in JS — the client_id lives on the joined project, and
  // PostgREST embedded filtering is fragile across schema versions.
  const filtered = clientFilter && clientFilter !== 'all'
    ? rows.filter((p: any) => p.project?.client_id === clientFilter)
    : rows

  const summary = { posts: 0, likes: 0, comments: 0, shares: 0, engagement: 0 }
  const platformMap: Record<string, { platform: string; posts: number; likes: number; comments: number; shares: number; engagement: number }> = {}
  const monthMap: Record<string, { month: string; posts: number; engagement: number }> = {}
  const scored: any[] = []

  for (const p of filtered) {
    const likes = num(p.likes)
    const comments = num(p.comments)
    const shares = num(p.shares)
    const engagement = likes + comments + shares

    summary.posts += 1
    summary.likes += likes
    summary.comments += comments
    summary.shares += shares
    summary.engagement += engagement

    const platform = p.platform || 'unknown'
    if (!platformMap[platform]) platformMap[platform] = { platform, posts: 0, likes: 0, comments: 0, shares: 0, engagement: 0 }
    const pm = platformMap[platform]
    pm.posts += 1; pm.likes += likes; pm.comments += comments; pm.shares += shares; pm.engagement += engagement

    const dateStr = p.scheduled_date || p.submission_date
    if (dateStr) {
      const month = String(dateStr).slice(0, 7) // YYYY-MM
      if (!monthMap[month]) monthMap[month] = { month, posts: 0, engagement: 0 }
      monthMap[month].posts += 1
      monthMap[month].engagement += engagement
    }

    scored.push({
      id: p.id,
      platform,
      client: p.project?.client?.company_name || p.project?.name || p.project?.domain || null,
      content_preview: p.post_content ? String(p.post_content).slice(0, 140) : '',
      likes, comments, shares, engagement,
      live_link: p.live_link || null,
      scheduled_date: p.scheduled_date || p.submission_date || null,
    })
  }

  const by_platform = Object.values(platformMap).sort((a, b) => b.engagement - a.engagement || b.posts - a.posts)
  const by_month = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))
  const top_posts = scored.sort((a, b) => b.engagement - a.engagement).slice(0, 10)

  return NextResponse.json({ summary, by_platform, by_month, top_posts })
}
