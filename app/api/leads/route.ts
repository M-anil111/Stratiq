import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STAGES = ['prospect', 'contacted', 'proposal_sent', 'won', 'lost']

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

  const stage = request.nextUrl.searchParams.get('stage') || ''

  let query = supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (stage && STAGES.includes(stage)) {
    query = query.eq('stage', stage)
  }

  const { data, error } = await query
  if (error) {
    // 42P01 = undefined_table — migration 023 not applied in this environment
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
  if (!body.company_name || !String(body.company_name).trim()) {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
  }
  const stage = body.stage && STAGES.includes(body.stage) ? body.stage : 'prospect'

  const { data, error } = await supabase
    .from('leads')
    .insert({
      organization_id: organizationId,
      company_name: String(body.company_name).trim(),
      contact_name: body.contact_name || null,
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      source: body.source || null,
      stage,
      estimated_value: body.estimated_value != null && body.estimated_value !== '' ? Number(body.estimated_value) : null,
      notes: body.notes || null,
      created_by: user.id,
    })
    .select('*')
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
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage)) return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    updates.stage = body.stage
  }
  if (body.company_name !== undefined) {
    if (!String(body.company_name).trim()) return NextResponse.json({ error: 'company_name cannot be empty' }, { status: 400 })
    updates.company_name = String(body.company_name).trim()
  }
  if (body.contact_name !== undefined) updates.contact_name = body.contact_name || null
  if (body.email !== undefined) updates.email = body.email || null
  if (body.phone !== undefined) updates.phone = body.phone || null
  if (body.website !== undefined) updates.website = body.website || null
  if (body.source !== undefined) updates.source = body.source || null
  if (body.estimated_value !== undefined) {
    updates.estimated_value = body.estimated_value != null && body.estimated_value !== '' ? Number(body.estimated_value) : null
  }
  if (body.notes !== undefined) updates.notes = body.notes || null

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', body.id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
