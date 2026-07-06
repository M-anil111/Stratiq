import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken } from '@/lib/google-oauth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const token = await getGoogleToken(supabase, userData?.organization_id)
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
