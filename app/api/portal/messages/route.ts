import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(organization_id)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('client_id', portalAccess.client_id)
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(organization_id)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json({ error: 'No access' }, { status: 403 })

  const { data: userData } = await supabase.from('users').select('full_name').eq('id', user.id).single()

  const body = await request.json()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      client_id: portalAccess.client_id,
      organization_id: (portalAccess.clients as any)?.organization_id,
      sender_id: user.id,
      sender_type: 'client',
      sender_name: userData?.full_name || user.email,
      content: body.content || body.message,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
