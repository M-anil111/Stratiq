import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()
  const { title, live_url, word_count, status, submission_date, author, comment, client_report } = body

  const updateRow: Record<string, any> = {
    title,
    live_url,
    word_count: word_count ?? null,
    status,
    submission_date,
    author,
    comment,
    client_report: client_report ?? true,
    updated_at: new Date().toISOString(),
  }

  let data: any = null
  let error: any = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase
      .from('blog_submissions')
      .update(updateRow)
      .eq('id', params.entryId)
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

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const { error } = await supabase
    .from('blog_submissions')
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
