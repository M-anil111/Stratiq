import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { notifyOrgManagers } from '@/lib/notify'

const MANAGER_ROLES = ['super_admin', 'admin', 'manager']

// PATCH /api/social/[id] — approve / reject / retry a social post.
// Enforces org scope + manager role. Tolerant of un-migrated columns
// (approved_by, approved_at, retry_count, failed_reason) — retries the
// update without them if the column is missing.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  const organizationId = userData?.organization_id
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!MANAGER_ROLES.includes(userData?.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '')
  if (!['approve', 'reject', 'retry'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Load the target post (scoped to org) so we can reason about scheduled_date
  // and craft a notification.
  const { data: post, error: loadErr } = await supabase
    .from('social_media_postings')
    .select('id, platform, post_content, scheduled_date, status, project_id')
    .eq('id', params.id)
    .eq('organization_id', organizationId)
    .single()

  if (loadErr) {
    if (loadErr.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const nowIso = new Date().toISOString()

  // Build the "full" update (with optional columns) and a "safe" fallback that
  // only touches the guaranteed `status` column.
  let fullUpdate: Record<string, any> = {}
  let safeUpdate: Record<string, any> = {}

  if (action === 'approve') {
    fullUpdate = { status: 'scheduled', approved_by: user.id, approved_at: nowIso }
    safeUpdate = { status: 'scheduled' }
  } else if (action === 'reject') {
    // 'rejected' is not in the check constraint — fall back to 'draft'.
    fullUpdate = { status: 'draft', approved_by: null, approved_at: null }
    safeUpdate = { status: 'draft' }
  } else {
    // retry
    fullUpdate = { status: 'scheduled', retry_count: 0, failed_reason: null }
    safeUpdate = { status: 'scheduled' }
  }

  async function applyUpdate(update: Record<string, any>) {
    return supabase
      .from('social_media_postings')
      .update(update)
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .select('id, platform, status, scheduled_date')
      .single()
  }

  let { data: updated, error: updErr } = await applyUpdate(fullUpdate)
  // Retry without optional columns if any of them is missing.
  if (updErr && /Could not find|does not exist|schema cache|column/i.test(updErr.message || '')) {
    ;({ data: updated, error: updErr } = await applyUpdate(safeUpdate))
  }
  if (updErr) {
    if (updErr.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId,
    userId: user.id,
    action: `social_post_${action}`,
    entityType: 'social_media_posting',
    entityId: params.id,
    detail: { platform: post.platform, status: updated?.status },
  })

  // Best-effort notify managers on approval.
  if (action === 'approve') {
    const snippet = (post.post_content || '').slice(0, 80)
    await notifyOrgManagers(supabase, organizationId, {
      type: 'info',
      severity: 'success',
      title: 'Social post approved',
      body: `A ${post.platform || ''} post was approved${snippet ? `: "${snippet}"` : ''}.`,
      link: '/social',
      entityType: 'social_media_posting',
      entityId: params.id,
    })
  }

  return NextResponse.json({ success: true, post: updated })
}
