import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent } from '@/lib/encryption'
import {
  isValidPlatform,
  resolveClientId,
  resolveClientSecret,
  SocialPlatform,
} from '@/lib/social-oauth'

type TokenResult = {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
  accountName: string | null
  accountHandle: string | null
  externalId: string | null
}

// Best-effort per-platform code → token exchange. Any network/shape failure
// throws and is caught by the caller (redirect with ?error=).
async function exchangeCode(
  platform: SocialPlatform,
  code: string,
  redirectUri: string
): Promise<TokenResult> {
  const clientId = resolveClientId(platform) || ''
  const clientSecret = resolveClientSecret(platform) || ''
  const out: TokenResult = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    accountName: null,
    accountHandle: null,
    externalId: null,
  }

  const expiresFrom = (secs?: number) =>
    secs ? new Date(Date.now() + secs * 1000).toISOString() : null

  if (platform === 'facebook' || platform === 'instagram') {
    const p = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })
    const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${p}`)
    const json = await res.json()
    if (json.error) throw new Error(json.error.message || 'token exchange failed')
    out.accessToken = json.access_token || null
    out.expiresAt = expiresFrom(json.expires_in)
    // Best-effort profile lookup.
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${json.access_token}`
      )
      const me = await meRes.json()
      out.externalId = me.id || null
      out.accountName = me.name || null
    } catch { /* ignore profile failure */ }
    return out
  }

  if (platform === 'youtube') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error_description || json.error)
    out.accessToken = json.access_token || null
    out.refreshToken = json.refresh_token || null
    out.expiresAt = expiresFrom(json.expires_in)
    return out
  }

  if (platform === 'linkedin') {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error_description || json.error)
    out.accessToken = json.access_token || null
    out.refreshToken = json.refresh_token || null
    out.expiresAt = expiresFrom(json.expires_in)
    return out
  }

  if (platform === 'tiktok') {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    const json = await res.json()
    if (json.error && json.error !== 'ok') {
      throw new Error(json.error_description || json.error)
    }
    out.accessToken = json.access_token || null
    out.refreshToken = json.refresh_token || null
    out.expiresAt = expiresFrom(json.expires_in)
    out.externalId = json.open_id || null
    return out
  }

  if (platform === 'x') {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
      }),
    })
    const json = await res.json()
    if (json.error) throw new Error(json.error_description || json.error)
    out.accessToken = json.access_token || null
    out.refreshToken = json.refresh_token || null
    out.expiresAt = expiresFrom(json.expires_in)
    return out
  }

  throw new Error('Unsupported platform')
}

export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const platform = params.platform
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/settings/social-accounts?error=${reason}&platform=${platform}`, request.url)
    )

  if (!isValidPlatform(platform)) return fail('invalid_platform')
  if (oauthError || !code) return fail('auth_failed')

  try {
    const redirectUri = `${origin}/api/auth/social/${platform}/callback`
    const tokens = await exchangeCode(platform, code, redirectUri)

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    if (!userData?.organization_id) throw new Error('No organization')

    const { error } = await supabase.from('social_accounts').insert({
      organization_id: userData.organization_id,
      platform,
      account_name: tokens.accountName,
      account_handle: tokens.accountHandle,
      external_id: tokens.externalId,
      // Tokens are stored ENCRYPTED (AES-256-GCM) — never plaintext.
      access_token: encryptIfPresent(tokens.accessToken),
      refresh_token: encryptIfPresent(tokens.refreshToken),
      token_expires_at: tokens.expiresAt,
      status: 'connected',
      connected_by: user.id,
    })
    if (error) throw new Error(error.message)

    return NextResponse.redirect(
      new URL(`/settings/social-accounts?connected=${platform}`, request.url)
    )
  } catch (err: any) {
    console.error(`Social OAuth callback error (${platform}):`, err?.message || err)
    return fail('auth_failed')
  }
}
