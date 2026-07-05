import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { data: org } = await supabase.from('organizations').select('id').single()
  if (!org) return NextResponse.json({ error: 'No org' }, { status: 400 })

  await supabase.from('organization_settings')
    .delete()
    .eq('organization_id', org.id)
    .in('key', ['qb_access_token', 'qb_refresh_token', 'qb_realm_id', 'qb_token_expiry', 'qb_connected'])

  return NextResponse.json({ success: true })
}
