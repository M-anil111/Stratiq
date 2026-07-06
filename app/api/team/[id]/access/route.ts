import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'
import { logAudit } from '@/lib/audit'

// Matches PostgREST "missing table" (42P01) / "missing column" (42703) so the
// route degrades gracefully before migration 029 is applied.
function isMissing(error: any) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    /Could not find|does not exist|schema cache/i.test(error.message || '')
  )
}

// GET — current project access for a member: { project_access, project_ids }
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { data: member } = await supabase
    .from('users')
    .select('id, project_access')
    .eq('id', params.id)
    .eq('organization_id', authz.organizationId)
    .single()

  const projectAccess = (member as any)?.project_access === 'specific' ? 'specific' : 'all'

  let projectIds: string[] = []
  const { data: rows, error } = await supabase
    .from('user_project_access')
    .select('project_id')
    .eq('organization_id', authz.organizationId)
    .eq('user_id', params.id)
  if (!error && rows) projectIds = rows.map((r: any) => r.project_id)

  return NextResponse.json({ project_access: projectAccess, project_ids: projectIds })
}

// PUT { project_access: 'all' | 'specific', project_ids: string[] }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  let body: { project_access?: string; project_ids?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const projectAccess = body.project_access === 'specific' ? 'specific' : 'all'
  const projectIds =
    projectAccess === 'specific' && Array.isArray(body.project_ids)
      ? Array.from(new Set(body.project_ids.filter((p): p is string => typeof p === 'string' && !!p)))
      : []

  // Confirm the member exists in this org
  const { data: member } = await supabase
    .from('users')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', authz.organizationId)
    .single()
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update the scope flag (tolerant of the column not existing yet)
  const { error: flagError } = await supabase
    .from('users')
    .update({ project_access: projectAccess })
    .eq('id', params.id)
    .eq('organization_id', authz.organizationId)
  if (flagError && !isMissing(flagError)) {
    return NextResponse.json({ error: flagError.message }, { status: 500 })
  }

  // Replace the specific-project rows. Wrapped so a missing table never hard-fails.
  const { error: delError } = await supabase
    .from('user_project_access')
    .delete()
    .eq('organization_id', authz.organizationId)
    .eq('user_id', params.id)
  if (delError && !isMissing(delError)) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }
  if (!delError && projectAccess === 'specific' && projectIds.length > 0) {
    const { error: insError } = await supabase.from('user_project_access').insert(
      projectIds.map(pid => ({ organization_id: authz.organizationId, user_id: params.id, project_id: pid }))
    )
    if (insError && !isMissing(insError)) {
      return NextResponse.json({ error: insError.message }, { status: 500 })
    }
  }

  await logAudit(supabase, {
    organizationId: authz.organizationId,
    userId: user.id,
    action: 'team_project_access_changed',
    entityType: 'user',
    entityId: params.id,
    detail: { project_access: projectAccess, project_ids: projectIds },
  })

  return NextResponse.json({ project_access: projectAccess, project_ids: projectIds })
}
