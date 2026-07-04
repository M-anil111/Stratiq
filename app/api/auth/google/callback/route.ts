import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=missing_params`)
  }

  let orgId: string
  let redirectTo: string = '/settings/integrations'

  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'))
    orgId = decoded.org_id
    redirectTo = decoded.redirect_to || redirectTo
  } catch {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=invalid_state`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()
  if (tokenData.error) {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=token_exchange_failed`)
  }

  const { access_token, refresh_token, expires_in } = tokenData
  const expiry = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

  const admin = createAdminClient()
  const settings = [
    { organization_id: orgId, key: 'google_access_token', value: access_token, updated_at: new Date().toISOString() },
    { organization_id: orgId, key: 'google_refresh_token', value: refresh_token || '', updated_at: new Date().toISOString() },
    { organization_id: orgId, key: 'google_token_expiry', value: expiry, updated_at: new Date().toISOString() },
    { organization_id: orgId, key: 'google_connected', value: 'true', updated_at: new Date().toISOString() },
  ]

  await admin
    .from('organization_settings')
    .upsert(settings, { onConflict: 'organization_id,key' })

  return NextResponse.redirect(`${appUrl}${redirectTo}?connected=google`)
}
