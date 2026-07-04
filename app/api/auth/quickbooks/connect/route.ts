import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase.from('organizations').select('id').single()

  const params = new URLSearchParams({
    client_id: process.env.QUICKBOOKS_CLIENT_ID!,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback`,
    response_type: 'code',
    access_type: 'offline',
    state: org?.id ?? user.id,
  })

  const url = `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`
  return NextResponse.redirect(url)
}
