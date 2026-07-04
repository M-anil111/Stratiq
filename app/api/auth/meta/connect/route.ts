import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = Buffer.from(JSON.stringify({ redirect_to: '/settings/integrations' })).toString('base64')

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`,
    scope: 'ads_read,ads_management,business_management',
    state,
  })

  const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  return NextResponse.redirect(metaAuthUrl)
}
