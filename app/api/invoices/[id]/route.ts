import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data, error } = await supabase
    .from('invoices')
    .select('*, client:clients(company_name)')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: body.status,
      due_date: body.due_date || null,
      line_items: lineItems,
      subtotal,
      tax_amount: taxAmount,
      total,
      amount_paid: parseFloat(body.amount_paid) || 0,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!['super_admin', 'admin', 'manager'].includes(userData?.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
