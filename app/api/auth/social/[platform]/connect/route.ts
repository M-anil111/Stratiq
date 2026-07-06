import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { isValidPlatform, isPlatformConfigured, buildAuthUrl } from '@/lib/social-oauth'

export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const platform = params.platform
  const origin = new URL(request.url).origin

  if (!isValidPlatform(platform)) {
    return NextResponse.redirect(
      new URL(`/settings/social-accounts?error=invalid_platform`, request.url)
    )
  }

  // Not configured → bounce back so the UI can offer manual add.
  if (!isPlatformConfigured(platform)) {
    return NextResponse.redirect(
      new URL(`/settings/social-accounts?error=not_configured&platform=${platform}`, request.url)
    )
  }

  // Random, unguessable state that also carries the platform for the callback.
  const nonce = randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({ platform, nonce })).toString('base64url')
  const redirectUri = `${origin}/api/auth/social/${platform}/callback`

  return NextResponse.redirect(buildAuthUrl(platform, redirectUri, state))
}
