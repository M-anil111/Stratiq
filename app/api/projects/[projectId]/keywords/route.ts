import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET keywords for a project, each with latest + previous position (from keyword_rankings)
export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = userData?.organization_id

  const search = request.nextUrl.searchParams.get('search')?.trim()

  let query = supabase
    .from('keywords')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (search) query = query.ilike('keyword', `%${search}%`)

  const { data: keywords, error } = await query

  if (error) {
    // 42P01 = undefined_table — migration 035 not applied in this environment
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (keywords || []).map(k => k.id)
  let rankingsByKeyword: Record<string, { position: number | null; checked_on: string }[]> = {}

  if (ids.length) {
    const { data: rankings, error: rErr } = await supabase
      .from('keyword_rankings')
      .select('keyword_id, position, checked_on, created_at')
      .eq('organization_id', orgId)
      .in('keyword_id', ids)
      .order('checked_on', { ascending: false })
      .order('created_at', { ascending: false })

    if (rErr && rErr.code === '42P01') return NextResponse.json({ __unavailable: true })
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    for (const r of rankings || []) {
      if (!rankingsByKeyword[r.keyword_id]) rankingsByKeyword[r.keyword_id] = []
      rankingsByKeyword[r.keyword_id].push({ position: r.position, checked_on: r.checked_on })
    }
  }

  const result = (keywords || []).map(k => {
    // rankings are sorted newest-first
    const rk = rankingsByKeyword[k.id] || []
    const latest = rk[0] ?? null
    const previous = rk[1] ?? null
    // history oldest-first for sparkline
    const history = [...rk].reverse().map(r => r.position)
    return {
      ...k,
      latest_position: latest ? latest.position : null,
      latest_checked_on: latest ? latest.checked_on : null,
      previous_position: previous ? previous.position : null,
      history,
    }
  })

  return NextResponse.json(result)
}

// POST create a keyword
export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  if (!body.keyword || !String(body.keyword).trim()) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('keywords')
    .insert({
      project_id: params.projectId,
      organization_id: userData.organization_id,
      keyword: String(body.keyword).trim(),
      search_engine: body.search_engine || 'google',
      location: body.location || null,
      target_url: body.target_url || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, latest_position: null, previous_position: null, history: [] }, { status: 201 })
}
