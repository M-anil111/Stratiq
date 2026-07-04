import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=no_code`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const org_id = userData?.organization_id

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (tokens.error) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=token_exchange`)

  const expiry = Date.now() + (tokens.expires_in * 1000)

  // Store tokens in organization_settings
  const entries = [
    { organization_id: org_id, key: 'google_access_token', value: tokens.access_token },
    { organization_id: org_id, key: 'google_refresh_token', value: tokens.refresh_token },
    { organization_id: org_id, key: 'google_token_expiry', value: String(expiry) },
    { organization_id: org_id, key: 'google_connected', value: 'true' },
  ]
  for (const entry of entries) {
    await supabase.from('organization_settings').upsert(entry, { onConflict: 'organization_id,key' })
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=google`)
}
