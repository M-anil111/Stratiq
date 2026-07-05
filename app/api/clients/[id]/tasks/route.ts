import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOrgAndClient(supabase: any, userId: string, clientId: string) {
  const { data: userData } = await supabase.from('users').select('organization_id, full_name').eq('id', userId).single()
  if (!userData?.organization_id) return null
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('organization_id', userData.organization_id).single()
  if (!client) return null
  return userData
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgAndClient(supabase, user.id, params.id)
  if (!userData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('client_tasks')
    .select('*, assigned_user:users!assigned_to(full_name)')
    .eq('client_id', params.id)
    .eq('organization_id', userData.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgAndClient(supabase, user.id, params.id)
  if (!userData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { data, error } = await supabase.from('client_tasks').insert({
    organization_id: userData.organization_id,
    client_id: params.id,
    title: body.title,
    description: body.description || null,
    status: body.status || 'open',
    priority: body.priority || 'medium',
    due_date: body.due_date || null,
    assigned_to: body.assigned_to || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgAndClient(supabase, user.id, params.id)
  if (!userData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { taskId, ...updates } = body
  const { data, error } = await supabase
    .from('client_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('client_id', params.id)
    .select().single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Tasks not available' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
