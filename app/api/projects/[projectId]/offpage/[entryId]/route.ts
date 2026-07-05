import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()
  const { submission_date, website_url, directory_site_id, directory_name, type, status, live_url, email, username, comment } = body

  const { data, error } = await supabase
    .from('offpage_submissions')
    .update({
      submission_date,
      website_url,
      directory_site_id: directory_site_id || null,
      directory_name: directory_name || null,
      type: type || 'directory_submission',
      status,
      live_url: live_url || null,
      email: email || null,
      username: username || null,
      comment: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.entryId)
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

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const { error } = await supabase
    .from('offpage_submissions')
    .delete()
    .eq('id', params.entryId)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Table not ready' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
