import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, BILLING_ROLES } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const clientId = searchParams.get('clientId') || searchParams.get('client_id')
  const status = searchParams.get('status')
  let query = supabase
    .from('invoices')
    .select('*, client:clients(company_name)')
    .eq('organization_id', userData.organization_id)
    .order('issue_date', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const authz = await requireRole(supabase, user.id, BILLING_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

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

  const payload: Record<string, any> = {
    organization_id: userData.organization_id,
    client_id: body.client_id,
    project_id: body.project_id || null,
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
  }

  // `project_id` (migration 028) may not exist on the live DB yet — retry
  // without it if the column is missing so invoice creation never breaks.
  let data: any = null
  let error: any = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await supabase.from('invoices').insert(payload).select().single()
    data = res.data
    error = res.error
    if (!error) break
    if (error.code === '42703' && 'project_id' in payload) {
      delete payload.project_id
      continue
    }
    break
  }

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Invoices table not set up yet. Please contact support.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
