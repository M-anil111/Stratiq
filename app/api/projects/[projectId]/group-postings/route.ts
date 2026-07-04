import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent } from '@/lib/encryption'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('group_postings')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .order('submission_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
    .from('group_postings')
    .insert({
      project_id: params.projectId,
      organization_id: userData.organization_id,
      platform: body.platform,
      group_name: body.group_name,
      group_url: body.group_url,
      post_type: body.post_type,
      post_content: body.post_content,
      live_link: body.live_link,
      status: body.status || 'live',
      submission_date: body.submission_date,
      username: body.username,
      password_encrypted: encryptIfPresent(body.password),
      member_count: body.member_count ? parseInt(body.member_count, 10) : null,
      comment: body.comment,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { password_encrypted, ...safe } = data as any
  return NextResponse.json(safe, { status: 201 })
}
