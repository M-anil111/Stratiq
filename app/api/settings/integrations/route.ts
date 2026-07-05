import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({})

  const { data } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', userData.organization_id)
    .in('key', [
      'google_connected', 'qb_connected', 'meta_connected',
      'google_access_token', 'qb_access_token', 'meta_access_token',
      'qb_last_synced', 'meta_last_synced', 'google_ads_last_synced', 'google_drive_last_synced',
    ])

  const settings: Record<string, string> = {}
  for (const row of data || []) {
    // Expose connection flags; strip actual tokens from response
    if (!row.key.endsWith('_token') && !row.key.endsWith('_expiry')) {
      settings[row.key] = row.value
    }
  }
  // Derive connected flags from token presence when explicit flag missing
  const hasGoogle = settings.google_connected === 'true' || !!data?.find(r => r.key === 'google_access_token' && r.value)
  const hasQb = settings.qb_connected === 'true' || !!data?.find(r => r.key === 'qb_access_token' && r.value)
  const hasMeta = settings.meta_connected === 'true'

  return NextResponse.json({
    ...settings,
    google_connected: hasGoogle ? 'true' : 'false',
    qb_connected: hasQb ? 'true' : 'false',
    meta_connected: hasMeta ? 'true' : 'false',
    qb_last_synced: settings.qb_last_synced || null,
    meta_last_synced: settings.meta_last_synced || null,
    google_ads_last_synced: settings.google_ads_last_synced || null,
    google_drive_last_synced: settings.google_drive_last_synced || null,
  })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData || !['super_admin', 'admin'].includes(userData.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as Record<string, string>
  const upserts = Object.entries(body)
    .filter(([key]) => key.startsWith('integration_'))
    .map(([key, value]) => ({
      organization_id: userData.organization_id,
      key,
      value,
      updated_at: new Date().toISOString(),
    }))

  if (upserts.length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('organization_settings')
    .upsert(upserts, { onConflict: 'organization_id,key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
