import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TASK_SELECT = '*, client:clients(id, company_name), assignee:users!assigned_to(id, full_name)'

async function getOrgContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organizationId: null }

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  return { supabase, user, organizationId: userData?.organization_id || null }
}

export async function GET(request: NextRequest) {
  const { supabase, user, organizationId } = await getOrgContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const assignee = searchParams.get('assignee') || 'all'
  const status = searchParams.get('status') || ''
  const overdue = searchParams.get('overdue') === '1'

  let query = supabase
    .from('client_tasks')
    .select(TASK_SELECT)
    .eq('organization_id', organizationId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (assignee === 'me') {
    query = query.eq('assigned_to', user.id)
  }
  if (status) {
    query = query.eq('status', status === 'completed' ? 'done' : status)
  }
  if (overdue) {
    const today = new Date().toISOString().slice(0, 10)
    query = query.lt('due_date', today).not('status', 'in', '("done","cancelled")')
  }

  const { data, error } = await query
  if (error) {
    // 42P01 = undefined_table — migrations 012/022 not applied in this environment
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const { supabase, user, organizationId } = await getOrgContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  if (!body.title || !String(body.title).trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_tasks')
    .insert({
      organization_id: organizationId,
      client_id: body.client_id || null,
      title: String(body.title).trim(),
      description: body.description || null,
      status: 'open',
      priority: body.priority || 'medium',
      due_date: body.due_date || null,
      assigned_to: body.assigned_to || null,
      created_by: user.id,
    })
    .select(TASK_SELECT)
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, organizationId } = await getOrgContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.completed === 'boolean') updates.status = body.completed ? 'done' : 'open'
  if (body.status !== undefined) updates.status = body.status
  if (body.title !== undefined) updates.title = body.title
  if (body.due_date !== undefined) updates.due_date = body.due_date || null
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to || null
  if (body.priority !== undefined) updates.priority = body.priority
  if (body.client_id !== undefined) updates.client_id = body.client_id || null

  const { data, error } = await supabase
    .from('client_tasks')
    .update(updates)
    .eq('id', body.id)
    .eq('organization_id', organizationId)
    .select(TASK_SELECT)
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
