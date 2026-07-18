import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('offpage_submissions')
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
  const insertRow: Record<string, any> = {
    project_id: params.projectId,
    organization_id: userData.organization_id,
    submission_date: body.submission_date,
    website_url: body.website_url,
    directory_site_id: body.directory_site_id || null,
    directory_name: body.directory_name || null,
    type: body.type || 'directory_submission',
    status: body.status || 'pending',
    live_url: body.live_url || null,
    email: body.email || null,
    username: body.username || null,
    comment: body.comment || null,
    client_report: body.client_report ?? true,
    created_by: user.id,
  }

  let data: any = null
  let error: any = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase.from('offpage_submissions').insert(insertRow).select().single()
    data = res.data
    error = res.error
    if (!error) break
    // PostgREST reports missing columns as: Could not find the 'X' column of 'offpage_submissions' in the schema cache
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in insertRow) {
      delete insertRow[missing]
      continue
    }
    break
  }

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

  const updateRow: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
  let data: any = null
  let error: any = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase
      .from('offpage_submissions')
      .update(updateRow)
      .eq('id', id)
      .eq('project_id', params.projectId)
      .eq('organization_id', userData?.organization_id)
      .select()
      .single()
    data = res.data
    error = res.error
    if (!error) break
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in updateRow) {
      delete updateRow[missing]
      continue
    }
    break
  }

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Table not ready' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { password_encrypted, ...safe } = data as any
  return NextResponse.json(safe)
}
