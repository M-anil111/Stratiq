import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isHelcimConfigured, createHostedPaymentUrl } from '@/lib/helcim'

// POST: returns (creating if needed) a Helcim hosted payment page URL for one of
// the portal client's OWN invoices. Verifies the invoice belongs to the logged-in
// portal client before generating a link — avoids the staff-role check on the
// staff pay route. Responds 400 with { configured: false } when Helcim isn't set up
// so the client UI can show a graceful "not available yet" note.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json({ error: 'No portal access' }, { status: 403 })

  const { data: client } = await supabase
    .from('clients')
    .select('id, organization_id, company_name')
    .eq('id', portalAccess.client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'No portal access' }, { status: 403 })

  // Verify the invoice belongs to THIS client (and org) before doing anything.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, status, payment_link')
    .eq('id', params.id)
    .eq('client_id', client.id)
    .eq('organization_id', client.organization_id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  if (!isHelcimConfigured() || !process.env.HELCIM_PAYMENT_PAGE_URL) {
    return NextResponse.json(
      { configured: false, error: 'Online payment is not available' },
      { status: 400 },
    )
  }

  if ((invoice.total || 0) <= 0) {
    return NextResponse.json({ error: 'Invoice has no payable amount' }, { status: 400 })
  }

  // Reuse an existing link if present.
  if (invoice.payment_link) {
    return NextResponse.json({ url: invoice.payment_link })
  }

  let url: string
  try {
    url = await createHostedPaymentUrl({
      amount: invoice.total,
      currency: 'USD',
      invoiceNumber: invoice.invoice_number,
      customerName: client.company_name || undefined,
      description: `Invoice #${invoice.invoice_number}`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not create payment link' }, { status: 500 })
  }

  // Persist the link; tolerate a missing payment_link column.
  try {
    await supabase.from('invoices')
      .update({ payment_link: url })
      .eq('id', params.id)
      .eq('client_id', client.id)
      .eq('organization_id', client.organization_id)
  } catch {
    // column missing — non-fatal
  }

  return NextResponse.json({ url })
}
