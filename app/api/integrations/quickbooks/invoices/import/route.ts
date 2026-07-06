import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'
import { requireRole, BILLING_ROLES } from '@/lib/authz'

// POST /api/integrations/quickbooks/invoices/import
// Body: { qb_ids: string[] } or { all: true }
// Pulls invoices FROM QuickBooks and upserts them as Stratiq invoices.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = userData?.organization_id
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const authz = await requireRole(supabase, user.id, BILLING_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const all: boolean = !!body.all
  const qbIds: string[] = Array.isArray(body.qb_ids) ? body.qb_ids.map(String) : []
  if (!all && qbIds.length === 0) {
    return NextResponse.json({ error: 'No invoices selected' }, { status: 400 })
  }

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

  const qbQuery = all
    ? 'SELECT * FROM Invoice ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS 100'
    : `SELECT * FROM Invoice WHERE Id IN (${qbIds.map(id => `'${id.replace(/'/g, '')}'`).join(',')}) MAXRESULTS 100`

  const res = await fetch(`${base}/v3/company/${realmId}/query?query=${encodeURIComponent(qbQuery)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: `QB request failed: ${res.status}`, detail }, { status: 502 })
  }

  const data = await res.json()
  const rawInvoices: any[] = data.QueryResponse?.Invoice || []

  // Preload clients for name matching (org-scoped, best-effort).
  const clientMap: Record<string, string> = {}
  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', orgId)
  for (const c of clientRows || []) {
    if (c.company_name) clientMap[c.company_name.trim().toLowerCase()] = c.id
  }

  // Preload existing invoice keys to skip already-imported rows.
  const existingQbIds = new Set<string>()
  const existingNumbers = new Set<string>()
  const { data: existingRows } = await supabase
    .from('invoices')
    .select('invoice_number, qb_invoice_id')
    .eq('organization_id', orgId)
  for (const r of existingRows || []) {
    if (r.qb_invoice_id) existingQbIds.add(String(r.qb_invoice_id))
    if (r.invoice_number) existingNumbers.add(String(r.invoice_number))
  }

  let imported = 0
  let skipped = 0
  let linked = 0

  for (const inv of rawInvoices) {
    const qbId = String(inv.Id)
    const docNumber = inv.DocNumber ? String(inv.DocNumber) : qbId
    if (existingQbIds.has(qbId) || existingNumbers.has(docNumber)) {
      skipped++
      continue
    }

    const total = parseFloat(inv.TotalAmt) || 0
    const balance = parseFloat(inv.Balance) || 0
    const custName = inv.CustomerRef?.name?.trim().toLowerCase()
    const clientId = custName ? (clientMap[custName] || null) : null

    // Missing-column-tolerant insert: retry while stripping any column PostgREST
    // reports as missing from the schema cache (e.g. qb_invoice_id / currency on
    // older DBs), so the import succeeds with whatever columns actually exist.
    const insertRow: Record<string, any> = {
      organization_id: orgId,
      client_id: clientId,
      invoice_number: docNumber,
      status: balance === 0 ? 'paid' : 'sent',
      issue_date: inv.TxnDate || new Date().toISOString().slice(0, 10),
      due_date: inv.DueDate || null,
      line_items: (inv.Line || [])
        .filter((l: any) => l.DetailType === 'SalesItemLineDetail')
        .map((l: any) => ({
          description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || '',
          qty: parseFloat(l.SalesItemLineDetail?.Qty) || 1,
          unit_price: parseFloat(l.SalesItemLineDetail?.UnitPrice) || 0,
          amount: parseFloat(l.Amount) || 0,
        })),
      subtotal: total,
      tax_amount: parseFloat(inv.TxnTaxDetail?.TotalTax) || 0,
      total,
      amount_paid: total - balance,
      currency: inv.CurrencyRef?.value || null,
      qb_invoice_id: qbId,
      created_by: user.id,
    }

    let error: any = null
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = await supabase.from('invoices').insert(insertRow)
      error = r.error
      if (!error) break
      if (error.code === '42P01') break
      const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
      if (missing && missing in insertRow) {
        delete insertRow[missing]
        continue
      }
      const checkViol = error.code === '23514' && error.message?.match(/invoices_([a-z_]+)_check/)?.[1]
      if (checkViol && checkViol in insertRow) {
        delete insertRow[checkViol]
        continue
      }
      break
    }

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Invoices table not set up yet.' }, { status: 503 })
      }
      // Skip individual failures rather than aborting the whole import.
      skipped++
      continue
    }

    imported++
    if (clientId) linked++
    existingQbIds.add(qbId)
    existingNumbers.add(docNumber)
  }

  return NextResponse.json({ imported, skipped, linked })
}
