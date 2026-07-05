import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, full_name').eq('id', user.id).single()
  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('client_id', clientId)
    .eq('organization_id', userData?.organization_id)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, full_name').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  let body: { client_id?: string; content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_id) return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  if (!body.content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .eq('id', body.client_id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!clientRow) return NextResponse.json({ error: 'client_id not found in your organization' }, { status: 403 })

  const { data, error } = await supabase
    .from('messages')
    .insert({
      client_id: body.client_id,
      organization_id: userData.organization_id,
      sender_id: user.id,
      sender_type: 'staff',
      sender_name: userData.full_name || user.email,
      content: body.content,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
