import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

async function getOrgClient(supabase: any, userId: string) {
  const res = await supabase.from('users').select('organization_id, role, permissions').eq('id', userId).single()
  if (res.error && (res.error.code === '42703' || /permissions/.test(res.error.message || ''))) {
    const fb = await supabase.from('users').select('organization_id, role').eq('id', userId).single()
    return fb.data
  }
  return res.data
}

// Bulk update — currently supports changing project_status for many clients in a
// single round-trip. Reuses the same org-scope + role gates as PUT /api/clients/[id].
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin', 'manager'].includes(userData.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string' && x) : []
  if (!ids.length) return NextResponse.json({ error: 'ids is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.project_status !== undefined) updates.project_status = body.project_status
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .in('id', ids)
    .eq('organization_id', userData.organization_id)
    .select('id')

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updatedCount = data?.length ?? 0
  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'clients_bulk_updated',
    entityType: 'client',
    entityId: ids[0],
    detail: { count: updatedCount, project_status: body.project_status },
  })

  return NextResponse.json({ success: true, updated: updatedCount })
}
