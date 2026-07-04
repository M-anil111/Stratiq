import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getValidAccessToken(orgId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry', 'google_connected'])

  const settings: Record<string, string> = {}
  for (const row of rows || []) settings[row.key] = row.value

  if (settings.google_connected !== 'true') return null

  // Check if token is still valid (with 5 min buffer)
  const expiry = settings.google_token_expiry ? new Date(settings.google_token_expiry).getTime() : 0
  if (Date.now() < expiry - 5 * 60 * 1000) {
    return settings.google_access_token
  }

  // Refresh the token
  if (!settings.google_refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: settings.google_refresh_token,
    }),
  })

  const data = await res.json()
  if (data.error || !data.access_token) return null

  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()
  await supabase.from('organization_settings').upsert([
    { organization_id: orgId, key: 'google_access_token', value: data.access_token, updated_at: new Date().toISOString() },
    { organization_id: orgId, key: 'google_token_expiry', value: newExpiry, updated_at: new Date().toISOString() },
  ], { onConflict: 'organization_id,key' })

  return data.access_token
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) return NextResponse.json({ error: 'not_connected' }, { status: 400 })

  const accessToken = await getValidAccessToken(userData.organization_id, supabase)
  if (!accessToken) return NextResponse.json({ error: 'not_connected' }, { status: 400 })

  const res = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    },
  })

  const data = await res.json()
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 })

  // resource names are like "customers/1234567890"
  const customerIds: string[] = (data.resourceNames || []).map((name: string) => name.replace('customers/', ''))

  // Fetch names for each customer using MCC
  const accounts = await Promise.all(
    customerIds.map(async (customerId) => {
      try {
        const infoRes = await fetch(
          `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
              'login-customer-id': process.env.GOOGLE_ADS_MCC_ID!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1' }),
          }
        )
        const infoData = await infoRes.json()
        const row = infoData.results?.[0]?.customer
        return {
          customer_id: customerId,
          descriptive_name: row?.descriptiveName || customerId,
        }
      } catch {
        return { customer_id: customerId, descriptive_name: customerId }
      }
    })
  )

  return NextResponse.json(accounts)
}
