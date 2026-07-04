import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!['super_admin', 'admin'].includes(userData?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  await admin
    .from('organization_settings')
    .delete()
    .eq('organization_id', userData.organization_id)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry', 'google_connected'])

  return NextResponse.json({ ok: true })
}
