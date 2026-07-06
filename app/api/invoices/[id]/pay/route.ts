import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isHelcimConfigured, createHostedPaymentUrl } from '@/lib/helcim'
import { requireRole, BILLING_ROLES } from '@/lib/authz'

// Returns (creating if needed) a Helcim hosted payment page URL for an invoice,
// for an in-app "Pay" button. Org-scoped.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const authz = await requireRole(supabase, user.id, BILLING_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  if (!isHelcimConfigured()) {
    return NextResponse.json({ error: 'Helcim is not configured' }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(company_name)')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if ((invoice.total || 0) <= 0) return NextResponse.json({ error: 'Invoice has no payable amount' }, { status: 400 })

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
      customerName: (invoice.client as any)?.company_name || undefined,
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
      .eq('organization_id', userData.organization_id)
  } catch {
    // column missing — non-fatal
  }

  return NextResponse.json({ url })
}
