import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const orgId = userData.organization_id
  const pattern = `%${q}%`

  const [clientsRes, projectsRes, invoicesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, company_name, project_status, mrr')
      .eq('organization_id', orgId)
      .ilike('company_name', pattern)
      .limit(5),
    supabase
      .from('projects')
      .select('id, name, client_id, clients(company_name)')
      .eq('organization_id', orgId)
      .ilike('name', pattern)
      .limit(5),
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, status, client_id, clients(company_name)')
      .eq('organization_id', orgId)
      .or(`invoice_number.ilike.${pattern},status.ilike.${pattern}`)
      .limit(5)
      .then(r => r)
      .catch(() => ({ data: [] })),
  ])

  const results = [
    ...(clientsRes.data || []).map(c => ({
      type: 'client',
      id: c.id,
      title: c.company_name,
      subtitle: c.project_status,
      url: `/clients/${c.id}`,
    })),
    ...(projectsRes.data || []).map(p => ({
      type: 'project',
      id: p.id,
      title: p.name,
      subtitle: (p.clients as any)?.company_name,
      url: `/clients/${p.client_id}`,
    })),
    ...(invoicesRes.data || []).map(i => ({
      type: 'invoice',
      id: i.id,
      title: i.invoice_number || `Invoice #${i.id.slice(0, 8)}`,
      subtitle: (i.clients as any)?.company_name,
      url: `/invoices`,
    })),
  ]

  return NextResponse.json({ results })
}
