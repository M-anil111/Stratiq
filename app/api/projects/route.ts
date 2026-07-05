import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// Matches PostgREST "missing table" (42P01) / "missing column" (42703) so the
// module degrades gracefully before migration 028 is applied.
function isMissing(error: any) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    /Could not find|does not exist|schema cache|relationship/i.test(error.message || '')
  )
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const status = sp.get('status') || ''
  const clientId = sp.get('client_id') || ''
  const search = sp.get('search') || ''

  // Join client company_name; fall back to a bare select if the relationship
  // or newly-added columns aren't present yet.
  const selects = [
    '*, client:clients!client_id(id, company_name, website)',
    '*',
  ]

  let projects: any[] | null = null
  let error: any = null
  for (const sel of selects) {
    let query = supabase
      .from('projects')
      .select(sel)
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (clientId) query = query.eq('client_id', clientId)
    const res = await query
    projects = res.data as any[] | null
    error = res.error
    if (!error) break
    if (!isMissing(error)) break
  }

  if (error) {
    if (isMissing(error)) {
      return NextResponse.json({ projects: [], migrationRequired: true, message: 'Projects table is unavailable. Apply the latest migrations.' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let list = projects || []

  // Client-side search over domain / name / client company.
  if (search) {
    const q = search.toLowerCase()
    list = list.filter((p: any) =>
      (p.domain || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.client?.company_name || '').toLowerCase().includes(q)
    )
  }

  // Lightweight financial rollup per project. Tolerant of invoices.project_id
  // not existing yet — in that case revenue/count are simply 0.
  let financialsAvailable = true
  const withFinancials = await Promise.all(
    list.map(async (p: any) => {
      if (!financialsAvailable) return { ...p, revenue: 0, invoice_count: 0 }
      const { data: invs, error: invErr } = await supabase
        .from('invoices')
        .select('total')
        .eq('organization_id', userData.organization_id)
        .eq('project_id', p.id)
      if (invErr) {
        if (isMissing(invErr)) financialsAvailable = false
        return { ...p, revenue: 0, invoice_count: 0 }
      }
      const revenue = (invs || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)
      return { ...p, revenue, invoice_count: (invs || []).length }
    })
  )

  return NextResponse.json({ projects: withFinancials })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin', 'manager', 'team_member'].includes(userData.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.client_id) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })

  // Resolve a domain fallback from the client's website when not supplied.
  let domain = body.domain
  if (!domain) {
    const { data: client } = await supabase
      .from('clients')
      .select('website, company_name')
      .eq('id', body.client_id)
      .eq('organization_id', userData.organization_id)
      .single()
    domain = client?.website || client?.company_name || 'unknown'
  }

  // Missing-column-tolerant insert: retry stripping columns PostgREST reports
  // as absent from the schema cache (e.g. name/start_date before migration 028).
  const insertRow: Record<string, any> = {
    organization_id: userData.organization_id,
    client_id: body.client_id,
    name: body.name || null,
    domain,
    status: body.status || 'active',
    industry: body.industry || null,
    services: body.services || [],
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    notes: body.notes || null,
    sales_manager_id: body.sales_manager_id || null,
    dm_manager_id: body.dm_manager_id || null,
  }

  let data: any = null
  let error: any = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase.from('projects').insert(insertRow).select().single()
    data = res.data
    error = res.error
    if (!error) break
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in insertRow) {
      delete insertRow[missing]
      continue
    }
    const checkViol = error.code === '23514' && error.message?.match(/projects_([a-z_]+)_check/)?.[1]
    if (checkViol && checkViol in insertRow) {
      delete insertRow[checkViol]
      continue
    }
    break
  }

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Projects table is unavailable. Apply the latest migrations.' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'project_created',
    entityType: 'project',
    entityId: data.id,
    detail: { name: body.name, domain },
  })

  return NextResponse.json(data, { status: 201 })
}
