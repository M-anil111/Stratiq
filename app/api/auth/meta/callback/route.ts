import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=meta_auth_failed`, request.url)
    )
  }

  try {
    // Step 1: Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`,
      code,
    })
    const shortRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
    )
    const shortJson = await shortRes.json()
    if (shortJson.error) throw new Error(shortJson.error.message)
    const shortToken = shortJson.access_token

    // Step 2: Exchange for long-lived token (60-day)
    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: shortToken,
    })
    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${longParams.toString()}`
    )
    const longJson = await longRes.json()
    if (longJson.error) throw new Error(longJson.error.message)
    const longToken = longJson.access_token

    // Step 3: Store in organization_settings
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) throw new Error('No organization found')

    const expiryMs = (Date.now() + 60 * 24 * 60 * 60 * 1000).toString()
    const admin = createAdminClient()

    const upserts = [
      { key: 'meta_access_token', value: longToken },
      { key: 'meta_token_expiry', value: expiryMs },
      { key: 'meta_connected', value: 'true' },
    ].map(({ key, value }) => ({
      organization_id: userData.organization_id,
      key,
      value,
      updated_at: new Date().toISOString(),
    }))

    const { error: dbError } = await admin
      .from('organization_settings')
      .upsert(upserts, { onConflict: 'organization_id,key' })

    if (dbError) throw new Error(dbError.message)

    return NextResponse.redirect(
      new URL('/settings/integrations?connected=meta', request.url)
    )
  } catch (err: any) {
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=meta_auth_failed`, request.url)
    )
  }
}
