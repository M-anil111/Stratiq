import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Map from UI toggle key prefix → DB column (email-channel only)
const UI_TO_DB: Record<string, string> = {
  notif_weekly_targets_email: 'weekly_target_email',
  notif_friday_reminder_email: 'friday_reminder_email',
  notif_missed_target_email: 'missed_target_email',
  notif_monthly_report_email: 'monthly_report_email',
  notif_client_message_email: 'new_message_email',
  notif_client_added_email: 'new_client_email',
}

const DB_TO_UI = Object.fromEntries(Object.entries(UI_TO_DB).map(([k, v]) => [v, k]))

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST116') return NextResponse.json({})
    return NextResponse.json({})
  }

  if (!data) return NextResponse.json({})

  // Build response: expose DB columns under both their own name and the UI key
  const result: Record<string, any> = { ...data }
  for (const [dbCol, uiKey] of Object.entries(DB_TO_UI)) {
    if (data[dbCol] !== undefined) result[uiKey] = data[dbCol]
  }

  // Merge in any extra prefs stored as JSONB
  if (data.preferences && typeof data.preferences === 'object') {
    Object.assign(result, data.preferences)
  }

  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Build known-column updates
  const knownUpdates: Record<string, any> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  for (const [uiKey, dbCol] of Object.entries(UI_TO_DB)) {
    if (body[uiKey] !== undefined) knownUpdates[dbCol] = body[uiKey]
    // Also accept old-style direct DB column names
    if (body[dbCol] !== undefined) knownUpdates[dbCol] = body[dbCol]
  }

  // Store all remaining keys (inapp toggles, other notification types) in preferences JSONB
  const knownUiKeys = new Set([...Object.keys(UI_TO_DB), ...Object.values(UI_TO_DB)])
  const extraPrefs: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!knownUiKeys.has(k) && k !== 'user_id' && k !== 'updated_at' && k !== 'id') {
      extraPrefs[k] = v
    }
  }
  if (Object.keys(extraPrefs).length > 0) {
    knownUpdates.preferences = extraPrefs
  }

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .upsert(knownUpdates, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    // If preferences column doesn't exist yet, retry without it
    if (error.message?.includes('preferences')) {
      const { preferences: _p, ...withoutPrefs } = knownUpdates
      const { data: data2, error: error2 } = await supabase
        .from('user_notification_prefs')
        .upsert(withoutPrefs, { onConflict: 'user_id' })
        .select()
        .single()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
      return NextResponse.json(data2)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
