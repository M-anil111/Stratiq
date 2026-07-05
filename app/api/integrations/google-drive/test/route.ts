import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getGoogleToken(supabase: any, orgId: string): Promise<string> {
  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry', 'google_connected'])

  const settings: Record<string, string> = {}
  for (const r of rows || []) settings[r.key] = r.value

  if (settings.google_connected !== 'true' || !settings.google_access_token) {
    throw new Error('Google not connected')
  }

  if (Number(settings.google_token_expiry) < Date.now() + 60000) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: settings.google_refresh_token,
      }),
    })
    const tokens = await res.json()
    if (tokens.access_token) {
      await supabase.from('organization_settings').upsert([
        { organization_id: orgId, key: 'google_access_token', value: tokens.access_token },
        { organization_id: orgId, key: 'google_token_expiry', value: String(Date.now() + (tokens.expires_in || 3600) * 1000) },
      ], { onConflict: 'organization_id,key' })
      return tokens.access_token
    }
  }

  return settings.google_access_token
}

// GET /api/integrations/google-drive/test
// Tests Google Drive connectivity by listing root folder contents, stores last-tested timestamp.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  let access_token: string
  try {
    access_token = await getGoogleToken(supabase, userData.organization_id)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='root'+in+parents&fields=files(id,name,mimeType)&pageSize=10`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )
  const json = await res.json()

  if (!res.ok || json.error) {
    return NextResponse.json({ error: json?.error?.message || `Drive API error ${res.status}` }, { status: 400 })
  }

  const now = new Date().toISOString()

  await supabase.from('organization_settings').upsert(
    { organization_id: userData.organization_id, key: 'google_drive_last_synced', value: now, updated_at: now },
    { onConflict: 'organization_id,key' }
  )

  return NextResponse.json({ ok: true, files: (json.files || []).length, synced_at: now })
}
