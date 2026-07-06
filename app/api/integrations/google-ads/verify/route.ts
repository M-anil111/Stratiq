import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken } from '@/lib/google-oauth'

// POST /api/integrations/google-ads/verify
// Verifies the Google Ads token is valid, lists accessible customers, and stores last-synced timestamp.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const access_token = await getGoogleToken(supabase, userData.organization_id)
  if (!access_token) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
  }

  // Verify by listing accessible Google Ads customers
  const res = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    },
  })
  const json = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: json?.error?.message || `Google Ads API error ${res.status}` }, { status: 400 })
  }

  const resourceNames: string[] = json.resourceNames || []
  const now = new Date().toISOString()

  await supabase.from('organization_settings').upsert(
    { organization_id: userData.organization_id, key: 'google_ads_last_synced', value: now, updated_at: now },
    { onConflict: 'organization_id,key' }
  )

  return NextResponse.json({ ok: true, accounts: resourceNames.length, synced_at: now })
}
