import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data || {})
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    weekly_target_email,
    friday_reminder_email,
    missed_target_email,
    monthly_report_email,
    new_message_email,
    new_client_email,
  } = body

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .upsert({
      user_id: user.id,
      weekly_target_email,
      friday_reminder_email,
      missed_target_email,
      monthly_report_email,
      new_message_email,
      new_client_email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
