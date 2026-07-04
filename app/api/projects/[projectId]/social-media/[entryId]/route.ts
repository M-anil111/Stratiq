import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent } from '@/lib/encryption'

export async function PUT(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()
  const { platform, type, status, live_link, submission_date, username, password, comment } = body

  const { data, error } = await supabase
    .from('social_media_postings')
    .update({ platform, type, status, live_link, submission_date, username, password_encrypted: encryptIfPresent(password), comment, updated_at: new Date().toISOString() })
    .eq('id', params.entryId)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { password_encrypted, ...safe } = data as any
  return NextResponse.json(safe)
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const { error } = await supabase
    .from('social_media_postings')
    .delete()
    .eq('id', params.entryId)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
