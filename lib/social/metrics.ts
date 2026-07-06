// Social engagement metrics polling.
//
// fetchPostMetrics() reads engagement stats for a single published post from
// each platform's insights API. runMetricsRefresh() sweeps the
// social_published_posts table on a decaying re-poll cadence: brand-new posts
// are polled often, older posts progressively less, and posts older than 30
// days are frozen (never re-polled once they have a metrics snapshot).

import { getSocialToken, SocialAccount } from '@/lib/social/token'

const GRAPH = 'https://graph.facebook.com/v19.0'

export type PostMetrics = {
  likes?: number
  comments_count?: number
  shares?: number
  impressions?: number
  reach?: number
  clicks?: number
}

const ACCOUNT_COLS =
  'id, organization_id, platform, account_name, access_token, refresh_token, token_expires_at, status, needs_reconnect, external_id'

async function j(res: Response): Promise<any> {
  try { return await res.json() } catch { return null }
}

function num(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// ---------------------------------------------------------------------------
// Per-platform insights reads
// ---------------------------------------------------------------------------

export async function fetchPostMetrics(
  platform: string,
  token: string,
  externalPostId: string,
  account: SocialAccount
): Promise<PostMetrics> {
  if (!externalPostId || !token) return {}
  try {
    switch (platform) {
      case 'facebook':
        return await fetchFacebookMetrics(token, externalPostId)
      case 'instagram':
        return await fetchInstagramMetrics(token, externalPostId)
      // Platforms without a simple/uniform insights read — filled in later.
      case 'x':
      case 'linkedin':
      case 'tiktok':
      case 'youtube':
      case 'threads':
      case 'bluesky':
      case 'pinterest':
      default:
        return {}
    }
  } catch {
    // Never throw from a metrics read — a single bad post must not abort the sweep.
    return {}
  }
}

async function fetchFacebookMetrics(token: string, postId: string): Promise<PostMetrics> {
  const out: PostMetrics = {}

  // Impressions / reach / clicks via the insights edge.
  const insUrl =
    `${GRAPH}/${postId}/insights` +
    `?metric=post_impressions,post_impressions_unique,post_clicks` +
    `&access_token=${encodeURIComponent(token)}`
  const insRes = await fetch(insUrl)
  const insData = await j(insRes)
  if (insRes.ok && Array.isArray(insData?.data)) {
    for (const m of insData.data) {
      const val = num(m?.values?.[0]?.value)
      if (val === undefined) continue
      if (m.name === 'post_impressions') out.impressions = val
      else if (m.name === 'post_impressions_unique') out.reach = val
      else if (m.name === 'post_clicks') out.clicks = val
    }
  }

  // Likes / comments / shares via summary counts on the post node.
  const fieldsUrl =
    `${GRAPH}/${postId}` +
    `?fields=shares,likes.summary(true),comments.summary(true)` +
    `&access_token=${encodeURIComponent(token)}`
  const fRes = await fetch(fieldsUrl)
  const fData = await j(fRes)
  if (fRes.ok && fData) {
    const likes = num(fData?.likes?.summary?.total_count)
    if (likes !== undefined) out.likes = likes
    const comments = num(fData?.comments?.summary?.total_count)
    if (comments !== undefined) out.comments_count = comments
    const shares = num(fData?.shares?.count)
    if (shares !== undefined) out.shares = shares
  }

  return out
}

async function fetchInstagramMetrics(token: string, mediaId: string): Promise<PostMetrics> {
  const out: PostMetrics = {}

  // Media insights: impressions/reach/likes/comments/shares.
  const insUrl =
    `${GRAPH}/${mediaId}/insights` +
    `?metric=impressions,reach,likes,comments,shares` +
    `&access_token=${encodeURIComponent(token)}`
  const insRes = await fetch(insUrl)
  const insData = await j(insRes)
  if (insRes.ok && Array.isArray(insData?.data)) {
    for (const m of insData.data) {
      const val = num(m?.values?.[0]?.value)
      if (val === undefined) continue
      switch (m.name) {
        case 'impressions': out.impressions = val; break
        case 'reach': out.reach = val; break
        case 'likes': out.likes = val; break
        case 'comments': out.comments_count = val; break
        case 'shares': out.shares = val; break
      }
    }
  }

  // Fallback for like/comment counts on the media node (older accounts /
  // media types where the insight metric is unavailable).
  if (out.likes === undefined || out.comments_count === undefined) {
    const fieldsUrl =
      `${GRAPH}/${mediaId}` +
      `?fields=like_count,comments_count` +
      `&access_token=${encodeURIComponent(token)}`
    const fRes = await fetch(fieldsUrl)
    const fData = await j(fRes)
    if (fRes.ok && fData) {
      if (out.likes === undefined) {
        const l = num(fData?.like_count)
        if (l !== undefined) out.likes = l
      }
      if (out.comments_count === undefined) {
        const c = num(fData?.comments_count)
        if (c !== undefined) out.comments_count = c
      }
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Decaying re-poll cadence
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

// Returns true if this post should be re-polled now, false if it should be
// skipped. Cadence decays with post age; posts older than 30 days that already
// have a snapshot are frozen.
function shouldPoll(publishedAt: string | null, metricsUpdatedAt: string | null, now: number): boolean {
  const published = publishedAt ? new Date(publishedAt).getTime() : now
  const ageMs = Math.max(0, now - published)

  // Never polled yet → always poll.
  if (!metricsUpdatedAt) return true

  // Frozen: published >30 days ago and we already have a snapshot.
  if (ageMs > 30 * DAY_MS) return false

  // Minimum interval between polls, growing with post age.
  let intervalMs: number
  if (ageMs < DAY_MS) intervalMs = 4 * 60 * 60 * 1000 // <1d old → every ~4 hours
  else if (ageMs < 7 * DAY_MS) intervalMs = DAY_MS // <7d old → daily
  else intervalMs = 3 * DAY_MS // <30d old → every ~3 days

  const lastPolled = new Date(metricsUpdatedAt).getTime()
  return now - lastPolled >= intervalMs
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

export type MetricsRefreshResult = {
  scanned: number
  updated: number
  skipped: number
  errors: string[]
}

export async function runMetricsRefresh(supabase: any, limit = 100): Promise<MetricsRefreshResult> {
  const result: MetricsRefreshResult = { scanned: 0, updated: 0, skipped: 0, errors: [] }
  const now = Date.now()

  // Oldest / never-refreshed first, then most recently published.
  const { data: posts, error } = await supabase
    .from('social_published_posts')
    .select('id, social_account_id, platform, external_post_id, published_at, metrics_updated_at')
    .order('metrics_updated_at', { ascending: true, nullsFirst: true })
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Missing table/column → nothing to do.
    if ((error as any).code === '42P01' || (error as any).code === '42703') return result
    result.errors.push(error.message || 'select failed')
    return result
  }
  if (!posts || posts.length === 0) return result

  // Cache resolved accounts to avoid re-fetching the same account per post.
  const accountCache = new Map<string, SocialAccount | null>()

  for (const post of posts) {
    result.scanned++
    try {
      if (!shouldPoll(post.published_at, post.metrics_updated_at, now)) {
        result.skipped++
        continue
      }
      if (!post.external_post_id) {
        result.skipped++
        continue
      }

      const accountId: string | null = post.social_account_id
      if (!accountId) { result.skipped++; continue }

      let account = accountCache.get(accountId)
      if (account === undefined) {
        const { data } = await supabase
          .from('social_accounts')
          .select(ACCOUNT_COLS)
          .eq('id', accountId)
          .maybeSingle()
        account = (data as SocialAccount) || null
        accountCache.set(accountId, account)
      }
      if (!account) { result.skipped++; continue }

      const tok = await getSocialToken(supabase, account)
      if (!tok.ok) { result.skipped++; continue }

      const metrics = await fetchPostMetrics(post.platform, tok.token, post.external_post_id, account)

      const patch: Record<string, any> = { metrics_updated_at: new Date().toISOString() }
      if (metrics.likes !== undefined) patch.likes = metrics.likes
      if (metrics.comments_count !== undefined) patch.comments_count = metrics.comments_count
      if (metrics.shares !== undefined) patch.shares = metrics.shares
      if (metrics.impressions !== undefined) patch.impressions = metrics.impressions
      if (metrics.reach !== undefined) patch.reach = metrics.reach
      if (metrics.clicks !== undefined) patch.clicks = metrics.clicks

      await safeUpdate(supabase, post.id, patch)
      result.updated++
    } catch (err: any) {
      result.errors.push(`post ${post.id}: ${err?.message || 'unknown error'}`)
    }
  }

  return result
}

// Resilient update: strips columns the table doesn't have, tolerates missing
// table, never throws.
async function safeUpdate(supabase: any, id: string, patch: Record<string, any>) {
  try {
    let working = { ...patch }
    for (let i = 0; i < 8; i++) {
      const { error } = await supabase.from('social_published_posts').update(working).eq('id', id)
      if (!error) return
      if ((error as any).code === '42P01') return
      const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
      if (missing && missing in working) { delete (working as any)[missing]; continue }
      return
    }
  } catch { /* noop */ }
}
