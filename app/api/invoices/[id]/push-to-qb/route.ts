import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'

// POST /api/invoices/[id]/push-to-qb
// Pushes a Stratiq invoice to QuickBooks as an Invoice object.
// Requires the client to have a QB customer mapping already.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Fetch invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(*)')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Fetch QB customer mapping for this client
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('external_id')
    .eq('client_id', invoice.client_id)
    .eq('platform', 'quickbooks')
    .single()
  if (!integration?.external_id) {
    return NextResponse.json({ error: 'No QB customer mapped for this client. Map one in the Integrations tab first.' }, { status: 400 })
  }

  try {
    const { token, realmId } = await getQBToken(supabase)
    const isSandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
    const base = isSandbox
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    const lineItems = (invoice.line_items || []).map((li: any, idx: number) => {
      const amount = parseFloat(li.amount) || (parseFloat(li.qty || 1) * parseFloat(li.unit_price || 0))
      const line: Record<string, any> = {
        LineNum: idx + 1,
        Amount: amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          Qty: parseFloat(li.qty) || 1,
          UnitPrice: parseFloat(li.unit_price) || amount,
        },
      }
      if (li.description) line.Description = li.description
      // If QB item id is mapped, reference it
      if (li.qb_item_id) {
        line.SalesItemLineDetail.ItemRef = { value: li.qb_item_id, name: li.name || li.description }
      }
      return line
    })

    const qbInvoice: Record<string, any> = {
      CustomerRef: { value: integration.external_id },
      Line: lineItems,
      TxnDate: invoice.issue_date,
      DueDate: invoice.due_date || undefined,
      DocNumber: invoice.invoice_number,
    }
    if (invoice.notes) qbInvoice.CustomerMemo = { value: invoice.notes }

    const method = invoice.qb_invoice_id ? 'POST' : 'POST'
    let url = `${base}/v3/company/${realmId}/invoice`

    // If already pushed, update (requires SyncToken)
    if (invoice.qb_invoice_id) {
      // Fetch current SyncToken first
      const fetchRes = await fetch(`${url}/${invoice.qb_invoice_id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (fetchRes.ok) {
        const existing = await fetchRes.json()
        qbInvoice.Id = invoice.qb_invoice_id
        qbInvoice.SyncToken = existing.Invoice?.SyncToken || '0'
        url = `${base}/v3/company/${realmId}/invoice`
      }
    }

    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(qbInvoice),
    })

    if (!res.ok) {
      const err = await res.json()
      const msg = err?.Fault?.Error?.[0]?.Message || err?.Fault?.Error?.[0]?.Detail || `QB error ${res.status}`
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const created = await res.json()
    const qbId = created.Invoice?.Id

    // Save QB invoice ID back to Stratiq
    await supabase.from('invoices').update({ qb_invoice_id: qbId, updated_at: new Date().toISOString() }).eq('id', params.id)

    return NextResponse.json({ qb_invoice_id: qbId, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'QB not connected' }, { status: 400 })
  }
}
