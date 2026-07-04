import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  let query = supabase
    .from('invoices')
    .select('*, client:clients(company_name, display_name)')
    .eq('organization_id', userData.organization_id)
    .order('issue_date', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await req.json()
  const lineItems: any[] = body.line_items || []
  const subtotal = lineItems.reduce((s: number, li: any) => s + (parseFloat(li.amount) || (parseFloat(li.qty || 1) * parseFloat(li.unit_price || 0))), 0)
  const taxAmount = parseFloat(body.tax_amount) || 0
  const total = subtotal + taxAmount

  // Generate invoice number
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userData.organization_id)
  const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`

  const { data, error } = await supabase.from('invoices').insert({
    organization_id: userData.organization_id,
    client_id: body.client_id,
    invoice_number: invoiceNumber,
    status: body.status || 'draft',
    issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    line_items: lineItems,
    subtotal,
    tax_amount: taxAmount,
    total,
    amount_paid: 0,
    notes: body.notes || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
