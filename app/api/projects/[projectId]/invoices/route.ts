import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isMissing(error: any) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    /Could not find|does not exist|schema cache/i.test(error.message || '')
  )
}

const MIGRATION_MSG = 'Invoice-to-project links are unavailable. Apply migration 028_project_financials.'

// GET invoices linked to this project.
export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, issue_date, due_date, total, amount_paid, client_id')
    .eq('organization_id', userData.organization_id)
    .eq('project_id', params.projectId)
    .order('issue_date', { ascending: false })

  if (error) {
    if (isMissing(error)) return NextResponse.json({ invoices: [], migrationRequired: true, message: MIGRATION_MSG })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoices: data || [] })
}

// POST { invoice_id } to link an existing invoice to this project.
export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  if (!body.invoice_id) return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('invoices')
    .update({ project_id: params.projectId })
    .eq('id', body.invoice_id)
    .eq('organization_id', userData.organization_id)
    .select()
    .single()

  if (error) {
    if (isMissing(error)) return NextResponse.json({ error: MIGRATION_MSG }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE ?invoice_id= to unlink an invoice from this project.
export async function DELETE(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const invoiceId = request.nextUrl.searchParams.get('invoice_id')
  if (!invoiceId) return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })

  const { error } = await supabase
    .from('invoices')
    .update({ project_id: null })
    .eq('id', invoiceId)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData.organization_id)

  if (error) {
    if (isMissing(error)) return NextResponse.json({ error: MIGRATION_MSG }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
