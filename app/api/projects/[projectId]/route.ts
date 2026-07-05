import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('projects')
    .select('*, tracking_tools(*), login_credentials(id, site_name, username, sort_order), social_media_accounts(*)')
    .eq('id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Attach client company + a lightweight financial rollup (tolerant of the
  // invoices.project_id column not existing yet — revenue/count fall back to 0).
  let client: any = null
  if (data.client_id) {
    const { data: c } = await supabase
      .from('clients')
      .select('id, company_name, website')
      .eq('id', data.client_id)
      .eq('organization_id', userData?.organization_id)
      .single()
    client = c || null
  }

  let revenue = 0
  let invoice_count = 0
  const { data: invs, error: invErr } = await supabase
    .from('invoices')
    .select('total')
    .eq('organization_id', userData?.organization_id)
    .eq('project_id', params.projectId)
  if (!invErr && invs) {
    revenue = invs.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)
    invoice_count = invs.length
  }

  return NextResponse.json({ ...data, client, revenue, invoice_count })
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()

  // Only include fields that were actually provided so we never clobber columns.
  const candidate: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of ['name', 'domain', 'status', 'industry', 'services', 'start_date', 'end_date', 'notes', 'advertising_types', 'goals'] as const) {
    if (key in body) candidate[key] = body[key]
  }

  // Missing-column-tolerant update: drop columns PostgREST doesn't recognise.
  let data: any = null
  let error: any = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase
      .from('projects')
      .update(candidate)
      .eq('id', params.projectId)
      .eq('organization_id', userData?.organization_id)
      .select()
      .single()
    data = res.data
    error = res.error
    if (!error) break
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in candidate) {
      delete candidate[missing]
      continue
    }
    break
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData?.organization_id,
    userId: user.id,
    action: 'project_updated',
    entityType: 'project',
    entityId: params.projectId,
    detail: { status: candidate.status, name: candidate.name },
  })

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()
  const { domain, status, industry, services, advertising_types, goals } = body

  const { data, error } = await supabase
    .from('projects')
    .update({ domain, status, industry, services, advertising_types, goals, updated_at: new Date().toISOString() })
    .eq('id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData?.organization_id,
    userId: user.id,
    action: 'project_updated',
    entityType: 'project',
    entityId: params.projectId,
    detail: { status, domain },
  })

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData || !['super_admin', 'admin'].includes(userData.role)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.projectId)
    .eq('organization_id', userData.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'project_deleted',
    entityType: 'project',
    entityId: params.projectId,
  })

  return NextResponse.json({ ok: true })
}
