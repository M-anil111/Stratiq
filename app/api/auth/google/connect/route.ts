import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { googleClientId, googleScopes, googleRedirectUri, appBaseUrl } from '@/lib/google-oauth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origin = request.nextUrl.origin
  const clientId = googleClientId()
  if (!clientId) {
    return NextResponse.redirect(`${appBaseUrl(origin)}/settings/integrations?error=google_client_id_missing`)
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    scope: googleScopes(),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: Buffer.from(JSON.stringify({ user_id: user.id })).toString('base64'),
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
