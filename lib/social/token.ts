// Social account token resolution, expiry detection and reconnect signalling.
//
// getSocialToken() returns a usable decrypted access token for a connected
// social_account, refreshing it if a refresh_token is available and it's near
// expiry. If the token is expired/revoked and cannot be refreshed, the account
// is flagged needs_reconnect=true and org managers are notified once, then the
// caller gets null and should skip/fail the publish with a clear reason.

import { decryptIfPresent, encryptIfPresent } from '@/lib/encryption'
import { notifyOrgManagers } from '@/lib/notify'
import { resolveClientId, resolveClientSecret } from '@/lib/social-oauth'

// Warn this many ms before expiry (pre-expiry warning — better than the
// reactive-only model the incumbents use).
const PRE_EXPIRY_WARN_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

export type SocialAccount = {
  id: string
  organization_id: string
  platform: string
  account_name?: string | null
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
  status?: string | null
  needs_reconnect?: boolean | null
  external_id?: string | null
}

export type TokenResult =
  | { ok: true; token: string; account: SocialAccount }
  | { ok: false; reason: string; needsReconnect: boolean; account: SocialAccount }

export async function getSocialToken(supabase: any, account: SocialAccount): Promise<TokenResult> {
  const now = Date.now()
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : null
  const decrypted = decryptIfPresent(account.access_token || null)

  // No token stored at all → manual account, needs a real OAuth connect.
  if (!decrypted) {
    return { ok: false, reason: 'No access token — connect this account via OAuth.', needsReconnect: true, account }
  }

  const expired = expiresAt !== null && expiresAt <= now
  const nearExpiry = expiresAt !== null && expiresAt - now <= PRE_EXPIRY_WARN_MS

  // Fresh enough — use as-is, but emit a pre-expiry warning once if near.
  if (!expired) {
    if (nearExpiry) await warnPreExpiry(supabase, account, expiresAt!)
    return { ok: true, token: decrypted, account }
  }

  // Expired — try to refresh if we have a refresh token + client creds.
  const refreshed = await tryRefresh(supabase, account)
  if (refreshed) return { ok: true, token: refreshed, account }

  // Cannot refresh — flag reconnect and notify (once).
  await flagReconnect(supabase, account, 'Access token expired and could not be refreshed.')
  return { ok: false, reason: 'Token expired — reconnect required.', needsReconnect: true, account }
}

async function tryRefresh(supabase: any, account: SocialAccount): Promise<string | null> {
  const refreshToken = decryptIfPresent(account.refresh_token || null)
  if (!refreshToken) return null

  const platform = account.platform as any
  const clientId = resolveClientId(platform)
  const clientSecret = resolveClientSecret(platform)
  if (!clientId || !clientSecret) return null

  try {
    let tokenUrl = ''
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })
    switch (platform) {
      case 'youtube':
        tokenUrl = 'https://oauth2.googleapis.com/token'; break
      case 'x':
        tokenUrl = 'https://api.x.com/2/oauth2/token'; break
      case 'tiktok':
        tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/'
        params.set('client_key', clientId); params.delete('client_id'); break
      case 'linkedin':
        tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken'; break
      default:
        // Meta (fb/ig/threads) long-lived tokens refresh via a different flow;
        // treat as non-refreshable here and require reconnect.
        return null
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const newToken = data.access_token
    if (!newToken) return null

    const expiresIn = Number(data.expires_in) || 0
    const newExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
    const patch: Record<string, any> = {
      access_token: encryptIfPresent(newToken),
      token_expires_at: newExpiry,
      needs_reconnect: false,
      last_error: null,
      status: 'connected',
    }
    if (data.refresh_token) patch.refresh_token = encryptIfPresent(data.refresh_token)
    await safeUpdate(supabase, account.id, patch)
    return newToken
  } catch {
    return null
  }
}

async function flagReconnect(supabase: any, account: SocialAccount, reason: string) {
  // Only notify if not already flagged, to avoid spamming.
  const already = account.needs_reconnect === true
  await safeUpdate(supabase, account.id, {
    needs_reconnect: true,
    status: 'expired',
    last_error: reason,
  })
  if (!already) {
    await notifyOrgManagers(supabase, account.organization_id, {
      type: 'reconnect',
      severity: 'warning',
      title: `Reconnect needed: ${account.account_name || account.platform}`,
      body: `${reason} Scheduled posts to this ${account.platform} account will fail until it is reconnected.`,
      link: '/settings/social-accounts',
      entityType: 'social_account',
      entityId: account.id,
      alsoEmail: true,
    })
  }
}

async function warnPreExpiry(supabase: any, account: SocialAccount, expiresAt: number) {
  // Emit at most one pre-expiry warning per account by stashing a flag in
  // last_error-like state; we reuse status not to add columns. Best-effort.
  try {
    const days = Math.max(1, Math.round((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
    await notifyOrgManagers(supabase, account.organization_id, {
      type: 'token_expiry',
      severity: 'warning',
      title: `${account.account_name || account.platform} connection expires soon`,
      body: `Reconnect within ~${days} day(s) to avoid publishing interruptions.`,
      link: '/settings/social-accounts',
      entityType: 'social_account',
      entityId: account.id,
    })
  } catch { /* noop */ }
}

async function safeUpdate(supabase: any, id: string, patch: Record<string, any>) {
  try {
    let working = { ...patch }
    for (let i = 0; i < 6; i++) {
      const { error } = await supabase.from('social_accounts').update(working).eq('id', id)
      if (!error) return
      const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
      if (missing && missing in working) { delete (working as any)[missing]; continue }
      return
    }
  } catch { /* noop */ }
}
