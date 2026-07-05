import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('blog_submissions')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .order('submission_date', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const safe = (data || []).map(({ password_encrypted, ...rest }: any) => rest)
  return NextResponse.json(safe)
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('blog_submissions')
    .insert({
      project_id: params.projectId,
      organization_id: userData.organization_id,
      title: body.title,
      live_url: body.live_url || null,
      word_count: body.word_count ?? null,
      status: body.status || 'draft',
      submission_date: body.submission_date || null,
      author: body.author || null,
      comment: body.comment || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Table not ready' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { password_encrypted, ...safe } = data as any
  return NextResponse.json(safe, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('blog_submissions')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Table not ready' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { password_encrypted, ...safe } = data as any
  return NextResponse.json(safe)
}
