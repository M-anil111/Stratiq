import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('onpage_details')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('organization_id', userData?.organization_id)
    .order('submission_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('onpage_details')
    .insert({
      project_id: params.projectId,
      organization_id: userData.organization_id,
      url: body.url,
      h1: body.h1,
      meta_title: body.meta_title,
      meta_description: body.meta_description,
      primary_keywords: body.primary_keywords || [],
      secondary_keywords: body.secondary_keywords || [],
      rankings: body.rankings,
      submission_date: body.submission_date,
      comment: body.comment,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
