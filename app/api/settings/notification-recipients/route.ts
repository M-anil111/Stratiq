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

  const { data, error } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', 'notification_emails')
    .single()

  // PGRST116 = no rows (normal on first load); 42P01 = table missing
  if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
    return NextResponse.json({ emails: '' })
  }

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

// POST: add a single email address to the list
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin'].includes(userData.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', 'notification_emails')
    .single()

  const currentList = (existing?.value || '').split(',').map((e: string) => e.trim()).filter(Boolean)
  if (!currentList.includes(email.trim())) {
    currentList.push(email.trim())
  }

  await supabase.from('organization_settings').upsert({
    organization_id: userData.organization_id,
    key: 'notification_emails',
    value: currentList.join(','),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,key' })

  return NextResponse.json({ success: true, emails: currentList.join(',') })
}

// DELETE: remove a single email address from the list
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin'].includes(userData.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', 'notification_emails')
    .single()

  const currentList = (existing?.value || '').split(',').map((e: string) => e.trim()).filter(Boolean)
  const updated = currentList.filter((e: string) => e !== email.trim())

  await supabase.from('organization_settings').upsert({
    organization_id: userData.organization_id,
    key: 'notification_emails',
    value: updated.join(','),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,key' })

  return NextResponse.json({ success: true, emails: updated.join(',') })
}
