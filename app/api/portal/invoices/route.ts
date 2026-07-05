import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: returns the logged-in portal client's own invoices (org + client scoped).
// Never exposes other clients' invoices.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess, error: accessError } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (accessError && accessError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to load portal access' }, { status: 500 })
  }
  if (!portalAccess) return NextResponse.json([])

  // Resolve the client's organization to scope by org as well.
  const { data: client } = await supabase
    .from('clients')
    .select('id, organization_id')
    .eq('id', portalAccess.client_id)
    .single()

  if (!client) return NextResponse.json([])

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total, currency, issue_date, due_date, paid_at, payment_link')
    .eq('client_id', client.id)
    .eq('organization_id', client.organization_id)
    .order('issue_date', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
