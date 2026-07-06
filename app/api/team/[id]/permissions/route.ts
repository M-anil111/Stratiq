import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { effectivePermissions, RESOURCES, type PermissionMap } from '@/lib/permissions'

// Granular per-user permissions API (the enforced core).
// GET: read a target user's role + effective/stored permissions.
// PUT: save per-user overrides (super_admin/admin only).
// Broader permission-set management and compare-access are future work.

const ADMIN_LIKE = ['admin', 'super_admin']

// Load target user scoped to the acting user's organization, tolerant of
// the `permissions` column not yet existing on the live DB (migration 038).
async function loadTarget(supabase: any, id: string, organizationId: string) {
  const res = await supabase
    .from('users')
    .select('id, full_name, email, role, permissions')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()
  if (res.error && (res.error.code === '42703' || /permissions/.test(res.error.message || ''))) {
    // Missing column: retry without it.
    const fallback = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()
    if (fallback.data) return { ...fallback.data, permissions: null }
    return null
  }
  return res.data || null
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!me?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const target = await loadTarget(supabase, params.id, me.organization_id)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stored: PermissionMap | null = target.permissions || null
  return NextResponse.json({
    user: { id: target.id, full_name: target.full_name, email: target.email, role: target.role },
    role: target.role,
    stored,
    effective: effectivePermissions(target.role, stored),
    resources: RESOURCES,
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only super_admin/admin may edit permissions.
  const authz = await requireRole(supabase, user.id, MANAGER_ROLES)
  if (!authz.ok || !ADMIN_LIKE.includes(authz.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const target = await loadTarget(supabase, params.id, authz.organizationId)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // A plain admin cannot edit another admin/super_admin (no privilege
  // elevation): admins may edit non-admin users only. super_admin may edit anyone.
  if (authz.role === 'admin' && ADMIN_LIKE.includes(target.role)) {
    return NextResponse.json({ error: 'Cannot edit an administrator\'s permissions' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  const permissions: PermissionMap | null =
    body && body.permissions && typeof body.permissions === 'object' ? body.permissions : null

  // Tolerant update: gracefully handle the column not existing yet.
  const { error } = await supabase
    .from('users')
    .update({ permissions })
    .eq('id', params.id)
    .eq('organization_id', authz.organizationId)

  if (error) {
    if (error.code === '42P01' || error.code === '42703' || /permissions/.test(error.message || '')) {
      return NextResponse.json(
        { error: 'Permissions storage is not available yet. Run migration 038_user_permissions.sql.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId: authz.organizationId,
    userId: user.id,
    action: 'permissions_changed',
    entityType: 'user',
    entityId: params.id,
    detail: { target_email: target.email, target_role: target.role, permissions },
  })

  return NextResponse.json({
    ok: true,
    stored: permissions,
    effective: effectivePermissions(target.role, permissions),
  })
}
