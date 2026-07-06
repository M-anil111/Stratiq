import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/integrations/meta-ads/verify
// Verifies the org-level Meta token is valid and stores a last-synced timestamp.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', userData.organization_id)
    .in('key', ['meta_access_token', 'meta_connected'])

  const settings: Record<string, string> = {}
  for (const r of rows || []) settings[r.key] = r.value

  if (settings.meta_connected !== 'true' || !settings.meta_access_token) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 })
  }

  // Verify token by fetching ad accounts
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&limit=10&access_token=${settings.meta_access_token}`
  )
  const json = await res.json()

  if (json.error) {
    return NextResponse.json({ error: json.error.message }, { status: 400 })
  }

  const accounts: Array<{ id: string; name: string }> = (json.data || []).map((a: any) => ({ id: a.id, name: a.name }))
  const now = new Date().toISOString()

  await supabase.from('organization_settings').upsert(
    { organization_id: userData.organization_id, key: 'meta_last_synced', value: now, updated_at: now },
    { onConflict: 'organization_id,key' }
  )

  return NextResponse.json({ ok: true, accounts: accounts.length, synced_at: now })
}
