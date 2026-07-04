import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SETTINGS_KEY = 'scheduled_reports'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json([])

  const { data } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', SETTINGS_KEY)
    .single()

  try {
    return NextResponse.json(data?.value ? JSON.parse(data.value) : [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await req.json()
  const orgId = userData.organization_id

  // Load existing schedules
  const { data: existing } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', SETTINGS_KEY)
    .single()

  let schedules: any[] = []
  try { schedules = existing?.value ? JSON.parse(existing.value) : [] } catch {}

  const newSchedule = {
    id: `${Date.now()}`,
    client_id: body.client_id,
    client: body.client,
    type: body.type,
    frequency: body.frequency,
    recipients: body.recipients || [],
    day: body.day,
    status: 'active',
    created_at: new Date().toISOString(),
  }
  schedules.unshift(newSchedule)

  await supabase
    .from('organization_settings')
    .upsert({
      organization_id: orgId,
      key: SETTINGS_KEY,
      value: JSON.stringify(schedules),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,key' })

  return NextResponse.json(newSchedule, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { id } = await req.json()
  const orgId = userData.organization_id

  const { data: existing } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', SETTINGS_KEY)
    .single()

  let schedules: any[] = []
  try { schedules = existing?.value ? JSON.parse(existing.value) : [] } catch {}
  schedules = schedules.filter((s: any) => s.id !== id)

  await supabase
    .from('organization_settings')
    .upsert({
      organization_id: orgId,
      key: SETTINGS_KEY,
      value: JSON.stringify(schedules),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,key' })

  return NextResponse.json({ ok: true })
}
