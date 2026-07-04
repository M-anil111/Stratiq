import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'

const QB_BASE = process.env.QUICKBOOKS_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let token: string, realmId: string
  try {
    const result = await getQBToken(supabase)
    token = result.token
    realmId = result.realmId
  } catch (err: any) {
    return NextResponse.json({ error: err.message === 'QuickBooks not connected' ? 'not_connected' : err.message }, { status: 400 })
  }

  const query = encodeURIComponent('SELECT * FROM Customer')
  const res = await fetch(`${QB_BASE}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: res.status })
  }

  const data = await res.json()
  const customers = (data.QueryResponse?.Customer || []).map((c: any) => ({
    id: c.Id,
    name: c.DisplayName || c.CompanyName || c.FullyQualifiedName,
    email: c.PrimaryEmailAddr?.Address ?? null,
  }))

  return NextResponse.json(customers)
}
