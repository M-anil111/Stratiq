import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyHelcimWebhook, getCardTransaction } from '@/lib/helcim'

// Helcim webhook receiver. No auth session (external caller).
// Helcim POSTs { id, type } and signs with HMAC-SHA256; we verify then fetch
// the full transaction and mark the matching invoice paid.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyHelcimWebhook(rawBody, req.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Only handle card transactions; ignore (200) everything else.
  if (payload?.type !== 'cardTransaction' || !payload?.id) {
    return NextResponse.json({ received: true })
  }

  let txn
  try {
    txn = await getCardTransaction(String(payload.id))
  } catch (err) {
    console.error('Helcim getCardTransaction failed:', err)
    // Return 200 so Helcim does not retry indefinitely on a transient fetch error we cannot resolve.
    return NextResponse.json({ received: true })
  }

  if (!txn.approved) {
    return NextResponse.json({ received: true })
  }

  // Service-role-less client is fine: match by transaction id or invoice number across orgs.
  const supabase = await createClient()

  // Match by helcim_transaction_id first, then by invoiceNumber.
  let invoice: any = null
  {
    const { data } = await supabase
      .from('invoices')
      .select('id, organization_id, status')
      .eq('helcim_transaction_id', txn.transactionId)
      .limit(1)
      .maybeSingle()
    invoice = data
  }
  if (!invoice && txn.invoiceNumber) {
    const { data } = await supabase
      .from('invoices')
      .select('id, organization_id, status')
      .eq('invoice_number', txn.invoiceNumber)
      .limit(1)
      .maybeSingle()
    invoice = data
  }

  if (!invoice) {
    console.warn('Helcim webhook: no matching invoice for txn', txn.transactionId, txn.invoiceNumber)
    return NextResponse.json({ received: true })
  }

  const now = new Date().toISOString()
  // Missing-column-tolerant: retry without helcim_transaction_id if that column is absent.
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: now, helcim_transaction_id: txn.transactionId, updated_at: now })
    .eq('id', invoice.id)
  if (error) {
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: now, updated_at: now })
      .eq('id', invoice.id)
  }

  return NextResponse.json({ received: true })
}
