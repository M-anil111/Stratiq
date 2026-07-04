import { createClient } from '@/lib/supabase/server'

async function getQBToken(supabase: any) {
  const { data: org } = await supabase.from('organizations').select('id').single()
  if (!org) throw new Error('No org')

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', org.id)
    .in('key', ['qb_access_token', 'qb_refresh_token', 'qb_realm_id', 'qb_token_expiry'])

  const map: Record<string, string> = {}
  settings?.forEach((s: any) => { map[s.key] = s.value })

  if (!map.qb_access_token) throw new Error('QuickBooks not connected')

  // Refresh if expired
  if (map.qb_token_expiry && Date.now() > parseInt(map.qb_token_expiry)) {
    const credentials = Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: map.qb_refresh_token })
    })
    const tokens = await res.json()
    await supabase.from('organization_settings').upsert([
      { organization_id: org.id, key: 'qb_access_token', value: tokens.access_token },
      { organization_id: org.id, key: 'qb_token_expiry', value: String(Date.now() + tokens.expires_in * 1000) },
      ...(tokens.refresh_token ? [{ organization_id: org.id, key: 'qb_refresh_token', value: tokens.refresh_token }] : [])
    ])
    map.qb_access_token = tokens.access_token
  }

  return { token: map.qb_access_token, realmId: map.qb_realm_id }
}

export { getQBToken }
