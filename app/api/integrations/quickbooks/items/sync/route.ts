import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'

// POST /api/integrations/quickbooks/items/sync
// Fetches all active Items from QB and upserts into qb_items cache table.
export async function POST(_req: NextRequest) {
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

    const query = encodeURIComponent("SELECT * FROM Item WHERE Active = true MAXRESULTS 1000")
    const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `QB request failed: ${res.status}`, detail: err }, { status: 502 })
    }

    const data = await res.json()
    const rawItems: any[] = data.QueryResponse?.Item || []

    const rows = rawItems.map((item: any) => ({
      organization_id: userData.organization_id,
      qb_id: item.Id,
      name: item.Name,
      description: item.Description || null,
      type: item.Type || null,
      unit_price: parseFloat(item.UnitPrice) || 0,
      sku: item.Sku || null,
      income_account_id: item.IncomeAccountRef?.value || null,
      income_account_name: item.IncomeAccountRef?.name || null,
      active: item.Active !== false,
      synced_at: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('qb_items')
        .upsert(rows, { onConflict: 'organization_id,qb_id' })
      if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Mark inactive any items no longer in QB
    const activeIds = rawItems.map((i: any) => i.Id)
    if (activeIds.length > 0) {
      await supabase
        .from('qb_items')
        .update({ active: false })
        .eq('organization_id', userData.organization_id)
        .not('qb_id', 'in', `(${activeIds.map((id: string) => `"${id}"`).join(',')})`)
    }

    return NextResponse.json({ synced: rows.length, items: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'QB not connected' }, { status: 400 })
  }
}
