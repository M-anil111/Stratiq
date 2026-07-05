import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_settings')
    .delete()
    .eq('organization_id', userData.organization_id)
    .in('key', ['meta_access_token', 'meta_token_expiry', 'meta_connected'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'integration_disconnected',
    entityType: 'integration',
    entityId: 'meta',
    detail: { provider: 'meta' },
  })

  return NextResponse.json({ ok: true })
}
