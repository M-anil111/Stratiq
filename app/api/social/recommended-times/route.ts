import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Recommended posting times, HubSpot / Hootsuite style.
// Analyzes the org's own social_media_postings history (last ~90 days), grouping
// by weekday + hour and weighting by engagement (likes + comments + shares) when
// those columns exist, otherwise by raw post count as a proxy. Returns the top 3
// time ranges per weekday. When there isn't enough signal (fewer than ~3 engaged
// posts) or the table/columns are missing (42P01 etc.), it falls back to
// industry-default best times.
//
// Response shape:
//   { recommended: [{ day, ranges: [{ start, end, score }] }],
//     source: 'history' | 'industry', platform?: string }
// where `day` is 0=Sun..6=Sat and start/end are "HH:MM" 24h strings.

const DAY_COUNT = 7
const HISTORY_DAYS = 90
const MIN_ENGAGED_POSTS = 3
const TOP_RANGES_PER_DAY = 3

// ---- Industry-default heuristics ---------------------------------------------
// These are widely-cited "best time to post" heuristics (not org-specific data):
// weekday mid-mornings (9–11am) and early afternoons (1–3pm) tend to perform best,
// with a few platform-typical peaks layered on top. Used only as a fallback.
type Range = { start: string; end: string; score: number }

const pad = (n: number) => String(n).padStart(2, '0')
const hourRange = (h: number, score: number): Range => ({ start: `${pad(h)}:00`, end: `${pad(h + 1)}:00`, score })

// Baseline weekday peaks (Mon–Fri). Weekends get a lighter, later set.
const WEEKDAY_DEFAULTS: Range[] = [hourRange(9, 0.9), hourRange(13, 0.8), hourRange(11, 0.6)]
const WEEKEND_DEFAULTS: Range[] = [hourRange(11, 0.6), hourRange(19, 0.5), hourRange(14, 0.4)]

// Platform-typical peak hours (24h) layered on top of the weekday baseline.
const PLATFORM_PEAKS: Record<string, number[]> = {
  facebook: [9, 13, 15],
  instagram: [11, 14, 19],
  linkedin: [8, 10, 12],
  x: [9, 12, 17],
  tiktok: [12, 18, 21],
  youtube: [15, 17, 20],
}

function industryDefaults(platform?: string): { day: number; ranges: Range[] }[] {
  const peaks = platform ? PLATFORM_PEAKS[platform.toLowerCase()] : undefined
  return Array.from({ length: DAY_COUNT }, (_, day) => {
    const isWeekend = day === 0 || day === 6
    let ranges: Range[]
    if (peaks && !isWeekend) {
      ranges = peaks.map((h, i) => hourRange(h, 0.9 - i * 0.15))
    } else {
      ranges = (isWeekend ? WEEKEND_DEFAULTS : WEEKDAY_DEFAULTS).map(r => ({ ...r }))
    }
    return { day, ranges: ranges.slice(0, TOP_RANGES_PER_DAY) }
  })
}

// Engagement columns that may or may not exist on the table.
const ENGAGEMENT_COLS = ['likes', 'comments', 'shares', 'engagement']

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') || undefined

  const since = new Date()
  since.setDate(since.getDate() - HISTORY_DAYS)
  const sinceISO = since.toISOString()

  // Try selects richest-first; peel off engagement columns if they don't exist.
  const selects = [
    `scheduled_date, platform, ${ENGAGEMENT_COLS.join(', ')}`,
    'scheduled_date, platform',
  ]

  let data: any[] | null = null
  let error: any = null
  let hasEngagement = false
  for (let i = 0; i < selects.length; i++) {
    let query = supabase
      .from('social_media_postings')
      .select(selects[i])
      .eq('organization_id', userData.organization_id)
      .gte('scheduled_date', sinceISO)
      .not('scheduled_date', 'is', null)
      .limit(2000)
    if (platform) query = query.eq('platform', platform)
    const res = await query
    data = res.data as any[] | null
    error = res.error
    if (!error) { hasEngagement = i === 0; break }
    // Missing table → industry defaults.
    if (error.code === '42P01') return NextResponse.json({ recommended: industryDefaults(platform), source: 'industry', platform })
    // Missing engagement columns → retry with the leaner select.
    if (!/Could not find|does not exist|schema cache/i.test(error.message || '')) break
  }

  if (error) {
    // Any other failure → degrade to industry defaults rather than erroring.
    return NextResponse.json({ recommended: industryDefaults(platform), source: 'industry', platform })
  }

  const rows = data || []

  // Weight of each post: engagement sum when available, else 1 (count proxy).
  const engagementOf = (r: any): number => {
    if (!hasEngagement) return 1
    const n = ['likes', 'comments', 'shares'].reduce((s, c) => s + (Number(r[c]) || 0), 0)
    const explicit = Number(r.engagement) || 0
    const total = n + explicit
    return total > 0 ? total : 0
  }

  // Count "engaged" posts to decide whether we have enough signal.
  let engagedPosts = 0
  // Accumulate score per day+hour.
  const buckets: Record<string, number> = {} // key `${day}-${hour}`
  for (const r of rows) {
    if (!r.scheduled_date) continue
    const d = new Date(r.scheduled_date)
    if (isNaN(d.getTime())) continue
    const w = engagementOf(r)
    if (hasEngagement ? w > 0 : true) engagedPosts++
    const key = `${d.getDay()}-${d.getHours()}`
    buckets[key] = (buckets[key] || 0) + (hasEngagement ? w : 1)
  }

  const enough = hasEngagement ? engagedPosts >= MIN_ENGAGED_POSTS : rows.length >= MIN_ENGAGED_POSTS
  if (!enough) {
    return NextResponse.json({ recommended: industryDefaults(platform), source: 'industry', platform })
  }

  // Normalize scores to 0..1 (relative to the busiest bucket) and pick top 3 per day.
  const maxScore = Math.max(1, ...Object.values(buckets))
  const recommended = Array.from({ length: DAY_COUNT }, (_, day) => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ h, score: buckets[`${day}-${h}`] || 0 }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_RANGES_PER_DAY)
    const ranges: Range[] = hours.map(x => ({
      start: `${pad(x.h)}:00`,
      end: `${pad(Math.min(23, x.h + 1))}:${x.h + 1 > 23 ? '59' : '00'}`,
      score: Math.round((x.score / maxScore) * 100) / 100,
    }))
    return { day, ranges }
  })

  // If, after grouping, no day has any ranges, fall back to industry.
  if (recommended.every(d => d.ranges.length === 0)) {
    return NextResponse.json({ recommended: industryDefaults(platform), source: 'industry', platform })
  }

  return NextResponse.json({ recommended, source: 'history', platform })
}
