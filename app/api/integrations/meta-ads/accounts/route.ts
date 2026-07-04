import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 })
  }

  // Get stored access token
  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', userData.organization_id)
    .in('key', ['meta_access_token', 'meta_connected'])

  const settings: Record<string, string> = {}
  for (const row of rows || []) {
    settings[row.key] = row.value
  }

  if (settings.meta_connected !== 'true' || !settings.meta_access_token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({
      access_token: settings.meta_access_token,
      fields: 'id,name,account_status,currency',
    })
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?${params.toString()}`
    )
    const json = await res.json()

    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 400 })
    }

    // Filter to only active accounts (account_status === 1)
    const accounts = (json.data || [])
      .filter((a: any) => a.account_status === 1)
      .map((a: any) => ({
        id: a.id,
        name: a.name,
        account_status: a.account_status,
        currency: a.currency,
      }))

    return NextResponse.json(accounts)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
