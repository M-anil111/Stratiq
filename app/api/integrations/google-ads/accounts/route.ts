import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAccessToken(supabase: any, orgId: string): Promise<string | null> {
  const { data: rows } = await supabase.from('organization_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry'])
  
  const settings: Record<string, string> = {}
  for (const row of rows || []) settings[row.key] = row.value

  if (!settings.google_access_token) return null

  // Refresh if expired
  if (Number(settings.google_token_expiry) < Date.now() + 60000) {
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
    const tokens = await res.json()
    if (tokens.access_token) {
      await supabase.from('organization_settings').upsert({ organization_id: orgId, key: 'google_access_token', value: tokens.access_token }, { onConflict: 'organization_id,key' })
      return tokens.access_token
    }
  }

  return settings.google_access_token
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const token = await getAccessToken(supabase, userData?.organization_id)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 403 })

  const res = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    },
  })
  const data = await res.json()
  
  // data.resourceNames looks like ["customers/1234567890"]
  const customerIds = (data.resourceNames || []).map((r: string) => r.replace('customers/', ''))
  
  // Get details for each customer
  const customers = await Promise.all(customerIds.slice(0, 20).map(async (id: string) => {
    const r = await fetch(`https://googleads.googleapis.com/v17/customers/${id}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '', 'login-customer-id': process.env.GOOGLE_ADS_MCC_ID || '' },
    })
    const c = await r.json()
    return { customer_id: id, name: c.descriptiveName || c.id || id }
  }))

  return NextResponse.json(customers)
}
