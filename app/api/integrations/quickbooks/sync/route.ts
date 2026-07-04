import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'

const QB_BASE = (sandbox: boolean) =>
  sandbox ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com'

// POST /api/integrations/quickbooks/sync
// Fetches QB customer data and syncs open invoices from QB for a linked client.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Get the mapped QB customer integration for this client
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'quickbooks')
    .single()

  if (!integration?.external_id) {
    return NextResponse.json({ error: 'No QuickBooks customer mapped for this client' }, { status: 404 })
  }

  const qbCustomerId = integration.external_id

  try {
    const { token, realmId } = await getQBToken(supabase)
    const base = QB_BASE(process.env.QUICKBOOKS_SANDBOX === 'true')

    // Fetch QB customer details
    const custRes = await fetch(`${base}/v3/company/${realmId}/customer/${qbCustomerId}?minorversion=65`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!custRes.ok) {
      const err = await custRes.text()
      return NextResponse.json({ error: `QB error fetching customer: ${custRes.status}`, detail: err }, { status: 502 })
    }
    const custData = await custRes.json()
    const customer = custData.Customer

    // Fetch open invoices for this customer
    const query = encodeURIComponent(
      `SELECT * FROM Invoice WHERE CustomerRef = '${qbCustomerId}' AND Balance != '0' MAXRESULTS 100`
    )
    const invRes = await fetch(`${base}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    const invData = await invRes.json()
    const qbInvoices: any[] = invData.QueryResponse?.Invoice || []

    // Upsert invoices into local invoices table
    let synced = 0
    for (const inv of qbInvoices) {
      const { error: upsertErr } = await supabase.from('invoices').upsert({
        organization_id: userData.organization_id,
        client_id: clientId,
        qb_invoice_id: inv.Id,
        invoice_number: inv.DocNumber || `QB-${inv.Id}`,
        status: parseFloat(inv.Balance || '0') > 0 ? 'sent' : 'paid',
        total: parseFloat(inv.TotalAmt || '0'),
        subtotal: parseFloat(inv.TotalAmt || '0'),
        amount_paid: parseFloat(inv.TotalAmt || '0') - parseFloat(inv.Balance || '0'),
        issue_date: inv.TxnDate || new Date().toISOString().slice(0, 10),
        due_date: inv.DueDate || null,
        line_items: (inv.Line || [])
          .filter((l: any) => l.DetailType === 'SalesItemLineDetail')
          .map((l: any) => ({
            description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || '',
            quantity: l.SalesItemLineDetail?.Qty || 1,
            unit_price: l.SalesItemLineDetail?.UnitPrice || 0,
            amount: l.Amount || 0,
            qb_item_id: l.SalesItemLineDetail?.ItemRef?.value || null,
          })),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,qb_invoice_id' })
      if (!upsertErr) synced++
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.Id,
        name: customer.DisplayName,
        email: customer.PrimaryEmailAddr?.Address || null,
        balance: customer.Balance || 0,
        open_balance: customer.OpenBalanceDate || null,
      },
      invoices_synced: synced,
      total_open_invoices: qbInvoices.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'QB not connected' }, { status: 400 })
  }
}
