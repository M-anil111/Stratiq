import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  await supabase.from('organization_settings')
    .delete()
    .eq('organization_id', authz.organizationId)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry', 'google_connected'])

  await logAudit(supabase, {
    organizationId: authz.organizationId,
    userId: user.id,
    action: 'integration_disconnected',
    entityType: 'integration',
    entityId: 'google',
    detail: { provider: 'google' },
  })

  return NextResponse.json({ ok: true })
}
