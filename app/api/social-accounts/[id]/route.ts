import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const MANAGER_ROLES = ['super_admin', 'admin', 'manager']

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!MANAGER_ROLES.includes(userData.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase
    .from('social_accounts')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'social_account_disconnected',
    entityType: 'social_account',
    entityId: params.id,
  })

  return NextResponse.json({ success: true })
}
