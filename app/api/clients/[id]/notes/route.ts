import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', params.id)
    .eq('organization_id', userData.organization_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, full_name').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase.from('client_notes').insert({
    organization_id: userData.organization_id,
    client_id: params.id,
    type: body.type || 'note',
    body: body.body,
    created_by: user.id,
    created_by_name: userData.full_name,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
