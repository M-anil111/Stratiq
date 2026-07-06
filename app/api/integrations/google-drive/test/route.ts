import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken } from '@/lib/google-oauth'

// GET /api/integrations/google-drive/test
// Tests Google Drive connectivity by listing root folder contents, stores last-tested timestamp.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const access_token = await getGoogleToken(supabase, userData.organization_id)
  if (!access_token) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
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
