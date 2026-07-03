import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await request.json()
  const { url, page_title, meta_description, h1, primary_keywords, secondary_keywords, status, comment } = body

  const { data, error } = await supabase
    .from('onpage_details')
    .update({ url, page_title, meta_description, h1, primary_keywords, secondary_keywords, status, comment, updated_at: new Date().toISOString() })
    .eq('id', params.entryId)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; entryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const { error } = await supabase
    .from('onpage_details')
    .delete()
    .eq('id', params.entryId)
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
