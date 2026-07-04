import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  
  await supabase.from('organization_settings')
    .delete()
    .eq('organization_id', userData?.organization_id)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry', 'google_connected'])

  return NextResponse.json({ ok: true })
}
