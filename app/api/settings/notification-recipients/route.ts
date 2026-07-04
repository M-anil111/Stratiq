import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET/PUT org-level notification_emails setting
// Value is comma-separated email list

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', 'notification_emails')
    .single()

  return NextResponse.json({ emails: data?.value || '' })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin'].includes(userData.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { emails } = await req.json()
  await supabase.from('organization_settings').upsert({
    organization_id: userData.organization_id,
    key: 'notification_emails',
    value: emails,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,key' })

  return NextResponse.json({ success: true })
}
