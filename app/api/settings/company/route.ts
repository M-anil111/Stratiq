import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const { data } = await supabase.from('organizations').select('name, contact_email, billing_email, timezone, logo_url').eq('id', userData?.organization_id).single()

  return NextResponse.json(data || {})
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!['super_admin', 'admin'].includes(userData?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, contact_email, billing_email, timezone, logo_url } = await request.json()
  const { data, error } = await supabase
    .from('organizations')
    .update({ name, contact_email, billing_email, timezone, logo_url, updated_at: new Date().toISOString() })
    .eq('id', userData.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
