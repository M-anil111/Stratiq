import { createClient } from '@/lib/supabase/server'

async function getQBToken(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = userData?.organization_id
  if (!orgId) throw new Error('No organization')

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['qb_access_token', 'qb_refresh_token', 'qb_realm_id', 'qb_token_expiry'])

  const map: Record<string, string> = {}
  settings?.forEach((s: any) => { map[s.key] = s.value })

  if (!map.qb_access_token) throw new Error('QuickBooks not connected')

  // Refresh if expired
  if (map.qb_token_expiry && Date.now() > parseInt(map.qb_token_expiry) - 60000) {
    const credentials = Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: map.qb_refresh_token })
    })
    const tokens = await res.json()
    if (tokens.access_token) {
      const upserts = [
        { organization_id: orgId, key: 'qb_access_token', value: tokens.access_token },
        { organization_id: orgId, key: 'qb_token_expiry', value: String(Date.now() + tokens.expires_in * 1000) },
      ]
      if (tokens.refresh_token) upserts.push({ organization_id: orgId, key: 'qb_refresh_token', value: tokens.refresh_token })
      await supabase.from('organization_settings').upsert(upserts, { onConflict: 'organization_id,key' })
      map.qb_access_token = tokens.access_token
    }
  }

  return { token: map.qb_access_token, realmId: map.qb_realm_id, orgId }
}

export { getQBToken }
