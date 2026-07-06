import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Verify the keyword belongs to a project in the caller's org.
async function loadKeyword(supabase: any, keywordId: string, projectId: string, orgId: string) {
  return supabase
    .from('keywords')
    .select('*')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('organization_id', orgId)
    .single()
}

// GET the keyword with its full ranking history (for a sparkline)
export async function GET(request: NextRequest, { params }: { params: { projectId: string; keywordId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = userData?.organization_id

  const { data: keyword, error } = await loadKeyword(supabase, params.keywordId, params.projectId, orgId)
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: rankings, error: rErr } = await supabase
    .from('keyword_rankings')
    .select('id, position, checked_on, created_at')
    .eq('keyword_id', params.keywordId)
    .eq('organization_id', orgId)
    .order('checked_on', { ascending: true })
    .order('created_at', { ascending: true })

  if (rErr && rErr.code === '42P01') return NextResponse.json({ __unavailable: true })
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  return NextResponse.json({ ...keyword, rankings: rankings || [] })
}

// PATCH: record a new ranking ({ position, checked_on? }) OR edit keyword fields
export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; keywordId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = userData?.organization_id
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Ownership check
  const { data: keyword, error: kErr } = await loadKeyword(supabase, params.keywordId, params.projectId, orgId)
  if (kErr) {
    if (kErr.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()

  // Record a new ranking
  if (body.position !== undefined || body.record_rank) {
    const position = body.position === '' || body.position == null ? null : parseInt(body.position, 10)
    const { data, error } = await supabase
      .from('keyword_rankings')
      .insert({
        keyword_id: params.keywordId,
        organization_id: orgId,
        position: Number.isNaN(position as any) ? null : position,
        checked_on: body.checked_on || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ranking: data })
  }

  // Edit keyword fields
  const fields: Record<string, any> = {}
  for (const f of ['keyword', 'search_engine', 'location', 'target_url'] as const) {
    if (body[f] !== undefined) fields[f] = body[f] || null
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('keywords')
    .update(fields)
    .eq('id', params.keywordId)
    .eq('project_id', params.projectId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE keyword (rankings cascade via FK, but we also clean up explicitly)
export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; keywordId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = userData?.organization_id

  // Ownership check
  const { error: kErr } = await loadKeyword(supabase, params.keywordId, params.projectId, orgId)
  if (kErr) {
    if (kErr.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase.from('keyword_rankings').delete().eq('keyword_id', params.keywordId).eq('organization_id', orgId)

  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', params.keywordId)
    .eq('project_id', params.projectId)
    .eq('organization_id', orgId)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
