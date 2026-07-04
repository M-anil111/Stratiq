import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  try {
    const { token, realmId } = await getQBToken(supabase)

    const isSandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
    const base = isSandbox
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    const query = encodeURIComponent("SELECT * FROM Item WHERE Active = true ORDER BY Name")
    const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[qb/items] QB error:', res.status, err)
      return NextResponse.json({ error: 'QuickBooks request failed', items: [] })
    }

    const data = await res.json()
    const rawItems = data.QueryResponse?.Item || []

    const items = rawItems.map((item: any) => ({
      id: item.Id,
      name: item.Name,
      description: item.Description || '',
      type: item.Type, // Service, Inventory, NonInventory
      unit_price: item.UnitPrice || 0,
      sku: item.Sku || '',
      active: item.Active,
    }))

    return NextResponse.json({ items, connected: true })
  } catch (err: any) {
    // QB not connected or token expired — return empty with connected: false
    console.warn('[qb/items] QB not available:', err.message)
    return NextResponse.json({ items: [], connected: false })
  }
}
