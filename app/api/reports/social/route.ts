import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Social publishing report. Org-scoped. Reports on publishing success/failure
// and recent launches. Resilient to a missing schema (migration 040 not yet
// applied): a missing table (42P01) or missing column (42703) degrades to
// zeros / empty lists rather than erroring.

const num = (v: any) => (typeof v === 'number' ? v : Number(v)) || 0

// Ignore "relation/column does not exist" and schema-cache errors so a partial
// or missing schema just yields empty data.
function tolerable(error: any): boolean {
  if (!error) return true
  if (error.code === '42P01' || error.code === '42703') return true
  return /does not exist|Could not find|schema cache|relationship/i.test(error.message || '')
}

const ENGAGEMENT_FIELDS = ['likes', 'comments_count', 'shares', 'impressions', 'reach', 'clicks'] as const
type EngagementKey = typeof ENGAGEMENT_FIELDS[number]

function emptyEngagement(): Record<EngagementKey, number> {
  return { likes: 0, comments_count: 0, shares: 0, impressions: 0, reach: 0, clicks: 0 }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  const orgId = userData.organization_id

  const { searchParams } = new URL(request.url)
  const startParam = searchParams.get('start') || ''
  const endParam = searchParams.get('end') || ''
  // Normalize to YYYY-MM-DD if valid, else undefined.
  const start = /^\d{4}-\d{2}-\d{2}/.test(startParam) ? startParam.slice(0, 10) : null
  const end = /^\d{4}-\d{2}-\d{2}/.test(endParam) ? endParam.slice(0, 10) : null
  // Inclusive end boundary → next day exclusive.
  const endExclusive = end ? new Date(new Date(end + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10) : null

  // --- 1. Published posts (archive) in range ---
  let publishedRows: any[] = []
  {
    let q = supabase
      .from('social_published_posts')
      .select('*')
      .eq('organization_id', orgId)
    if (start) q = q.gte('published_at', start)
    if (endExclusive) q = q.lt('published_at', endExclusive)
    const res = await q.order('published_at', { ascending: false }).limit(2000)
    if (res.error) {
      if (!tolerable(res.error)) return NextResponse.json({ error: res.error.message }, { status: 500 })
    } else {
      publishedRows = res.data || []
    }
  }

  // --- 2. Postings (source-of-truth) for failures + scheduled + platform failed counts ---
  let postingRows: any[] = []
  {
    let q = supabase
      .from('social_media_postings')
      .select('*')
      .eq('organization_id', orgId)
    // Range applies to failed/published via published_at OR scheduled via scheduled_date;
    // filter in JS to keep the query resilient across schema versions.
    const res = await q.limit(4000)
    if (res.error) {
      if (!tolerable(res.error)) return NextResponse.json({ error: res.error.message }, { status: 500 })
    } else {
      postingRows = res.data || []
    }
  }

  const inRange = (dateStr: any): boolean => {
    if (!dateStr) return !start && !end
    const d = String(dateStr).slice(0, 10)
    if (start && d < start) return false
    if (end && d > end) return false
    return true
  }

  // --- Per-platform aggregation ---
  const platformMap: Record<string, {
    platform: string
    published: number
    failed: number
    engagement: Record<EngagementKey, number>
  }> = {}
  const ensurePlatform = (p: string) => {
    if (!platformMap[p]) platformMap[p] = { platform: p, published: 0, failed: 0, engagement: emptyEngagement() }
    return platformMap[p]
  }

  // Published (from archive) drive published counts + engagement totals.
  for (const r of publishedRows) {
    const platform = r.platform || 'unknown'
    const pm = ensurePlatform(platform)
    pm.published += 1
    for (const f of ENGAGEMENT_FIELDS) pm.engagement[f] += num(r[f])
  }

  // Failures + scheduled come from postings.
  const failures: any[] = []
  let scheduledCount = 0
  const SCHEDULED_STATUSES = new Set(['scheduled', 'pending_approval', 'approved', 'publishing'])

  for (const p of postingRows) {
    const platform = p.platform || 'unknown'
    const status = p.status || ''
    if (status === 'failed' && inRange(p.published_at || p.scheduled_date)) {
      ensurePlatform(platform).failed += 1
      failures.push({
        id: p.id,
        platform,
        failed_reason: p.failed_reason || null,
        retry_count: num(p.retry_count),
        content_preview: p.post_content ? String(p.post_content).slice(0, 140) : '',
        scheduled_date: p.scheduled_date || null,
      })
    } else if (SCHEDULED_STATUSES.has(status)) {
      // Upcoming: scheduled in the future (or no range constraint).
      const d = p.scheduled_date ? String(p.scheduled_date).slice(0, 10) : null
      const isUpcoming = d ? d >= new Date().toISOString().slice(0, 10) : true
      if (isUpcoming) scheduledCount += 1
    }
  }

  const totalPublished = publishedRows.length
  const totalFailed = failures.length
  const successDenom = totalPublished + totalFailed
  const successRate = successDenom > 0 ? Math.round((totalPublished / successDenom) * 100) : 0

  const by_platform = Object.values(platformMap)
    .sort((a, b) => b.published - a.published || b.failed - a.failed)

  // --- Launches (recently published), newest first ---
  const launches = publishedRows
    .slice()
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')))
    .slice(0, 50)
    .map((r) => ({
      id: r.id ?? r.external_post_id ?? `${r.platform}-${r.published_at}`,
      platform: r.platform || 'unknown',
      content_snippet: r.content_snippet ? String(r.content_snippet).slice(0, 160) : '',
      permalink: r.permalink || null,
      published_at: r.published_at || null,
    }))

  return NextResponse.json({
    summary: {
      published: totalPublished,
      failed: totalFailed,
      scheduled: scheduledCount,
      success_rate: successRate,
    },
    by_platform,
    failures: failures.sort((a, b) => String(b.scheduled_date || '').localeCompare(String(a.scheduled_date || ''))),
    launches,
  })
}
