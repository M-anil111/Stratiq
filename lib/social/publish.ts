// Publish orchestrator — the heart of the scheduling lifecycle.
//
// Called by the publish cron. For each due post it: resolves the connected
// account + token (refreshing/reconnect-flagging as needed), publishes to the
// network, and then:
//   • on success  → writes a lightweight social_published_posts reference,
//                    deletes the post's media from Google Drive (space), and
//                    DELETES the heavy social_media_postings row.
//   • on failure  → bounded auto-retry (retry_count), then status='failed',
//                    records the reason, and notifies org managers (in-app+email).
//
// Everything is tolerant of un-migrated columns/tables so it degrades safely.

import { getSocialToken, SocialAccount } from '@/lib/social/token'
import { publishToPlatform } from '@/lib/social/publishers'
import { notifyOrgManagers } from '@/lib/notify'
import { deleteFileFromDrive } from '@/lib/google-drive'

const MAX_RETRIES = 3

const ACCOUNT_COLS =
  'id, organization_id, platform, account_name, access_token, refresh_token, token_expires_at, status, needs_reconnect, external_id'

export type PublishRunResult = { published: number; failed: number; retried: number; skipped: number }

export async function runDuePublishes(supabase: any, limit = 50): Promise<PublishRunResult> {
  const nowIso = new Date().toISOString()
  const result: PublishRunResult = { published: 0, failed: 0, retried: 0, skipped: 0 }

  // Due = scheduled/approved with a scheduled_date in the past.
  const { data: due, error } = await supabase
    .from('social_media_postings')
    .select('*')
    .in('status', ['scheduled', 'approved'])
    .lte('scheduled_date', nowIso)
    .order('scheduled_date', { ascending: true })
    .limit(limit)

  if (error || !due?.length) return result

  for (const post of due) {
    try {
      await publishOne(supabase, post, result)
    } catch (e: any) {
      await markFailed(supabase, post, e?.message || 'Unexpected publish error')
      result.failed++
    }
  }
  return result
}

async function publishOne(supabase: any, post: any, result: PublishRunResult) {
  // Claim the row to avoid double-publishing across overlapping cron runs.
  const { data: claimed } = await supabase
    .from('social_media_postings')
    .update({ status: 'publishing' })
    .eq('id', post.id)
    .eq('status', post.status)
    .select('id')
    .maybeSingle?.() ?? { data: { id: post.id } }
  if (claimed === null) { result.skipped++; return }

  const account = await resolveAccount(supabase, post)
  if (!account) {
    await markFailed(supabase, post, `No connected ${post.platform} account. Connect one in Social Accounts.`)
    result.failed++
    return
  }

  const tok = await getSocialToken(supabase, account)
  if (!tok.ok) {
    await markFailed(supabase, post, tok.reason)
    result.failed++
    return
  }

  const isVideo = ['video', 'reel'].includes(post.type) || ['video', 'reel'].includes(post.content_type)
  const mediaUrls: string[] = post.media_url ? [post.media_url] : []
  const pub = await publishToPlatform(post.platform, tok.token, {
    platform: post.platform,
    text: post.post_content || '',
    mediaUrl: post.media_url || null,
    mediaUrls,
    isVideo,
    link: post.link || null,
    externalAccountId: account.external_id || null,
    firstComment: post.first_comment || null,
  })

  if (pub.ok) {
    await onPublished(supabase, post, account, pub)
    result.published++
    return
  }

  // Failure — bounded retry.
  const retries = (post.retry_count || 0) + 1
  if (retries < MAX_RETRIES) {
    await safeUpdate(supabase, post.id, {
      status: 'scheduled', // will be retried on the next cron tick
      retry_count: retries,
      failed_reason: pub.error || 'Publish failed; will retry.',
    })
    result.retried++
    return
  }
  await markFailed(supabase, { ...post, retry_count: retries }, pub.error || 'Publish failed after retries.')
  result.failed++
}

// Success path: record ref, reap media, delete heavy row.
async function onPublished(supabase: any, post: any, account: SocialAccount, pub: any) {
  const snippet = (post.post_content || '').slice(0, 240)
  // 1) lightweight archive reference
  await safeInsert(supabase, 'social_published_posts', {
    organization_id: post.organization_id,
    project_id: post.project_id || null,
    social_account_id: account.id,
    platform: post.platform,
    external_post_id: pub.externalId || null,
    permalink: pub.permalink || null,
    content_snippet: snippet,
    published_at: new Date().toISOString(),
  })

  // 2) reap media from Drive (space-conscious) — best effort
  const fileIds: string[] = Array.isArray(post.media_drive_file_ids) ? post.media_drive_file_ids : []
  for (const fid of fileIds) {
    try { await deleteFileFromDrive(fid) } catch { /* noop */ }
  }

  // 3) delete the heavy scheduling row
  const { error: delErr } = await supabase.from('social_media_postings').delete().eq('id', post.id)
  if (delErr) {
    // If we can't delete (e.g. RLS in cron context), at least mark it published.
    await safeUpdate(supabase, post.id, {
      status: 'published',
      external_post_id: pub.externalId || null,
      permalink: pub.permalink || null,
      published_at: new Date().toISOString(),
    })
  }

  // 4) success notification (low severity)
  await notifyOrgManagers(supabase, post.organization_id, {
    type: 'publish_success',
    severity: 'success',
    title: `Published to ${post.platform}`,
    body: snippet || 'Your scheduled post went live.',
    link: pub.permalink || '/social',
    entityType: 'social_post',
    entityId: post.id,
  })
}

async function markFailed(supabase: any, post: any, reason: string) {
  await safeUpdate(supabase, post.id, {
    status: 'failed',
    failed_reason: reason,
    retry_count: post.retry_count || 0,
  })
  await notifyOrgManagers(supabase, post.organization_id, {
    type: 'publish_failed',
    severity: 'error',
    title: `Post failed on ${post.platform}`,
    body: reason,
    link: '/social',
    entityType: 'social_post',
    entityId: post.id,
    alsoEmail: true,
  })
}

async function resolveAccount(supabase: any, post: any): Promise<SocialAccount | null> {
  // Prefer an explicitly linked account, else the org's connected account for
  // this platform.
  if (post.social_account_id) {
    const { data } = await supabase.from('social_accounts').select(ACCOUNT_COLS).eq('id', post.social_account_id).maybeSingle()
    if (data) return data
  }
  const { data } = await supabase
    .from('social_accounts')
    .select(ACCOUNT_COLS)
    .eq('organization_id', post.organization_id)
    .eq('platform', post.platform)
    .neq('status', 'manual')
    .order('created_at', { ascending: false })
    .limit(1)
  return (data && data[0]) || null
}

async function safeInsert(supabase: any, table: string, row: Record<string, any>) {
  try {
    let working = { ...row }
    for (let i = 0; i < 8; i++) {
      const { error } = await supabase.from(table).insert(working)
      if (!error) return
      if (error.code === '42P01') return
      const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
      if (missing && missing in working) { delete (working as any)[missing]; continue }
      return
    }
  } catch { /* noop */ }
}

async function safeUpdate(supabase: any, id: string, patch: Record<string, any>) {
  try {
    let working = { ...patch }
    for (let i = 0; i < 8; i++) {
      const { error } = await supabase.from('social_media_postings').update(working).eq('id', id)
      if (!error) return
      if (error.code === '42P01') return
      const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
      if (missing && missing in working) { delete (working as any)[missing]; continue }
      return
    }
  } catch { /* noop */ }
}
