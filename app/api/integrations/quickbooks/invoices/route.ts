import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'

// GET /api/integrations/quickbooks/invoices
// Returns a normalized preview list of recent QuickBooks invoices. Read-only.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  let token: string, realmId: string
  try {
    const t = await getQBToken(supabase)
    token = t.token
    realmId = t.realmId
  } catch {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
  }

  const isSandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
  const base = isSandbox
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'

  const query = encodeURIComponent('SELECT * FROM Invoice ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS 100')
  const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: `QB request failed: ${res.status}`, detail }, { status: 502 })
  }

  const data = await res.json()
  const rawInvoices: any[] = data.QueryResponse?.Invoice || []

  const invoices = rawInvoices.map((inv: any) => ({
    qb_id: inv.Id,
    doc_number: inv.DocNumber || null,
    customer_name: inv.CustomerRef?.name || null,
    txn_date: inv.TxnDate || null,
    due_date: inv.DueDate || null,
    total_amt: parseFloat(inv.TotalAmt) || 0,
    balance: parseFloat(inv.Balance) || 0,
    currency: inv.CurrencyRef?.value || null,
  }))

  return NextResponse.json({ invoices })
}
