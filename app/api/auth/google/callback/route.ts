import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { googleClientId, googleClientSecret, googleRedirectUri, appBaseUrl, encryptGoogleToken } from '@/lib/google-oauth'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const base = appBaseUrl(origin)
  const settingsUrl = `${base}/settings/integrations`

  const { searchParams } = new URL(request.url)
  const oauthError = searchParams.get('error')
  if (oauthError) return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(oauthError)}`)

  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${settingsUrl}?error=no_code`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${base}/login`)

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const org_id = userData?.organization_id
  if (!org_id) return NextResponse.redirect(`${settingsUrl}?error=no_org`)

  // Exchange code for tokens
  let tokens: any
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: googleRedirectUri(origin),
        grant_type: 'authorization_code',
      }),
    })
    tokens = await tokenRes.json()
  } catch {
    return NextResponse.redirect(`${settingsUrl}?error=token_exchange`)
  }

  if (tokens.error || !tokens.access_token) {
    return NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(tokens.error || 'token_exchange')}`)
  }

  const expiry = Date.now() + ((tokens.expires_in || 3600) * 1000)

  // Store tokens ENCRYPTED in organization_settings (never plaintext).
  const entries: { organization_id: string; key: string; value: string }[] = [
    { organization_id: org_id, key: 'google_access_token', value: encryptGoogleToken(tokens.access_token) },
    { organization_id: org_id, key: 'google_token_expiry', value: String(expiry) },
    { organization_id: org_id, key: 'google_connected', value: 'true' },
  ]
  // A refresh_token is only returned on the first consent; preserve the existing one otherwise.
  if (tokens.refresh_token) {
    entries.push({ organization_id: org_id, key: 'google_refresh_token', value: encryptGoogleToken(tokens.refresh_token) })
  }

  for (const entry of entries) {
    await supabase.from('organization_settings').upsert(entry, { onConflict: 'organization_id,key' })
  }

  await logAudit(supabase, {
    organizationId: org_id,
    userId: user.id,
    action: 'integration_connected',
    entityType: 'integration',
    entityId: 'google',
    detail: { provider: 'google' },
  })

  return NextResponse.redirect(`${settingsUrl}?connected=google`)
}
