import { NextRequest, NextResponse } from 'next/server'
import {
  getDashboardContext, validateDashboardName, sanitizeWidgets,
  logDashboardActivity, defaultDashboardKey, makeWidget,
  canViewDashboard, canEditWidgets, canManageDashboard,
  ACCESS_LEVELS, FAVORITE_LIMIT, RESTORE_WINDOW_DAYS,
} from '../lib'

const DASHBOARD_SELECT = '*, owner:users!dashboards_owner_id_fkey(id, full_name, email)'

async function fetchDashboard(supabase: any, id: string, organizationId: string) {
  const { data, error } = await supabase
    .from('dashboards')
    .select(DASHBOARD_SELECT)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  return { data, error }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, organizationId, isAdmin } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data, error } = await fetchDashboard(supabase, params.id, organizationId)
  if (error) {
    // 42P01 = undefined_table — migration 024 not applied in this environment
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || (data.deleted_at && !isAdmin)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canViewDashboard(data, user.id, isAdmin)) {
    return NextResponse.json({ error: 'This dashboard is private' }, { status: 403 })
  }

  return NextResponse.json({
    ...data,
    can_edit: canEditWidgets(data, user.id, isAdmin) && !data.deleted_at,
    can_manage: canManageDashboard(data, user.id, isAdmin),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, organizationId, isAdmin } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: dashboard, error: fetchError } = await fetchDashboard(supabase, params.id, organizationId)
  if (fetchError) {
    if (fetchError.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!dashboard || dashboard.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canViewDashboard(dashboard, user.id, isAdmin)) {
    return NextResponse.json({ error: 'This dashboard is private' }, { status: 403 })
  }

  const body = await request.json()

  // --- Favorite toggle: append/remove caller in favorited_by, cap 10 per user ---
  if (typeof body.favorite === 'boolean') {
    const current: string[] = dashboard.favorited_by || []
    let next = current.filter(id => id !== user.id)
    if (body.favorite) {
      const { count } = await supabase
        .from('dashboards')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .contains('favorited_by', [user.id])
      if ((count || 0) >= FAVORITE_LIMIT && !current.includes(user.id)) {
        return NextResponse.json({ error: `You can favorite at most ${FAVORITE_LIMIT} dashboards` }, { status: 400 })
      }
      next = [...next, user.id]
    }
    const { data, error } = await supabase
      .from('dashboards')
      .update({ favorited_by: next })
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .select(DASHBOARD_SELECT)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logDashboardActivity(
      supabase, organizationId, params.id, user.id,
      body.favorite ? 'favorited' : 'unfavorited',
      `${body.favorite ? 'Favorited' : 'Removed favorite from'} dashboard "${dashboard.name}"`
    )
    return NextResponse.json(data)
  }

  // --- Per-user default: stored in organization_settings key default_dashboard_<userId> ---
  if (typeof body.set_default === 'boolean') {
    const key = defaultDashboardKey(user.id)
    if (body.set_default) {
      // Upserting on (organization_id, key) inherently unsets any other default for this user
      const { error } = await supabase
        .from('organization_settings')
        .upsert(
          [{ organization_id: organizationId, key, value: params.id, updated_at: new Date().toISOString() }],
          { onConflict: 'organization_id,key' }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      await supabase
        .from('organization_settings')
        .delete()
        .eq('organization_id', organizationId)
        .eq('key', key)
    }
    await logDashboardActivity(
      supabase, organizationId, params.id, user.id,
      body.set_default ? 'set_default' : 'unset_default',
      `${body.set_default ? 'Set' : 'Removed'} "${dashboard.name}" as ${body.set_default ? '' : 'their '}default dashboard`
    )
    return NextResponse.json({ ok: true, default_dashboard_id: body.set_default ? params.id : null })
  }

  // --- Content edits ---
  const canManage = canManageDashboard(dashboard, user.id, isAdmin)
  const canEdit = canEditWidgets(dashboard, user.id, isAdmin)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const activities: { action: string; detail: string }[] = []

  if (body.name !== undefined) {
    if (!canEdit) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    const nameError = validateDashboardName(body.name)
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })
    const name = String(body.name).trim()
    if (name !== dashboard.name) {
      updates.name = name
      activities.push({ action: 'renamed', detail: `Renamed dashboard from "${dashboard.name}" to "${name}"` })
    }
  }

  if (body.description !== undefined) {
    if (!canEdit) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    updates.description = body.description ? String(body.description) : null
    activities.push({ action: 'updated_description', detail: 'Updated the dashboard description' })
  }

  if (body.access !== undefined) {
    if (!canManage) return NextResponse.json({ error: 'Only the owner or an admin can change access' }, { status: 403 })
    if (!(ACCESS_LEVELS as readonly string[]).includes(body.access)) {
      return NextResponse.json({ error: 'Invalid access level' }, { status: 400 })
    }
    if (body.access !== dashboard.access) {
      updates.access = body.access
      activities.push({ action: 'changed_access', detail: `Changed access from "${dashboard.access}" to "${body.access}"` })
    }
  }

  if (body.owner_id !== undefined) {
    if (!canManage) return NextResponse.json({ error: 'Only the owner or an admin can change the owner' }, { status: 403 })
    const { data: newOwner } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', body.owner_id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!newOwner) return NextResponse.json({ error: 'Owner must be a member of this organization' }, { status: 400 })
    if (newOwner.id !== dashboard.owner_id) {
      updates.owner_id = newOwner.id
      activities.push({ action: 'changed_owner', detail: `Changed owner to ${newOwner.full_name || newOwner.id}` })
    }
  }

  if (body.widgets !== undefined) {
    if (!canEdit) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    const widgets = sanitizeWidgets(body.widgets)
    if (!widgets) return NextResponse.json({ error: 'Invalid widgets payload' }, { status: 400 })
    updates.widgets = widgets
    const prevCount = Array.isArray(dashboard.widgets) ? dashboard.widgets.length : 0
    activities.push({
      action: 'updated_widgets',
      detail: `Updated widgets (${prevCount} → ${widgets.length})`,
    })
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dashboards')
    .update(updates)
    .eq('id', params.id)
    .eq('organization_id', organizationId)
    .select(DASHBOARD_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const a of activities) {
    await logDashboardActivity(supabase, organizationId, params.id, user.id, a.action, a.detail)
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, organizationId, isAdmin } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: dashboard, error: fetchError } = await fetchDashboard(supabase, params.id, organizationId)
  if (fetchError) {
    if (fetchError.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!dashboard || dashboard.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canManageDashboard(dashboard, user.id, isAdmin)) {
    return NextResponse.json({ error: 'Only the owner or an admin can delete this dashboard' }, { status: 403 })
  }

  const { error } = await supabase
    .from('dashboards')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('organization_id', organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logDashboardActivity(
    supabase, organizationId, params.id, user.id,
    'deleted',
    `Deleted dashboard "${dashboard.name}" (restorable for ${RESTORE_WINDOW_DAYS} days)`
  )

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, organizationId, isAdmin } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const action = body?.action

  const { data: dashboard, error: fetchError } = await fetchDashboard(supabase, params.id, organizationId)
  if (fetchError) {
    if (fetchError.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'clone') {
    if (dashboard.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canViewDashboard(dashboard, user.id, isAdmin)) {
      return NextResponse.json({ error: 'This dashboard is private' }, { status: 403 })
    }
    // Fresh widget ids for the copy
    const widgets = (Array.isArray(dashboard.widgets) ? dashboard.widgets : [])
      .map((w: any) => makeWidget(w.type, w.title, w.config || {}))
    const { data, error } = await supabase
      .from('dashboards')
      .insert({
        organization_id: organizationId,
        name: `${dashboard.name} (copy)`,
        description: dashboard.description,
        owner_id: user.id,
        access: dashboard.access,
        widgets,
      })
      .select(DASHBOARD_SELECT)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logDashboardActivity(
      supabase, organizationId, data.id, user.id,
      'cloned',
      `Cloned from dashboard "${dashboard.name}"`
    )
    return NextResponse.json(data, { status: 201 })
  }

  if (action === 'restore') {
    if (!isAdmin) return NextResponse.json({ error: 'Only admins can restore dashboards' }, { status: 403 })
    if (!dashboard.deleted_at) return NextResponse.json({ error: 'Dashboard is not deleted' }, { status: 400 })
    const cutoff = Date.now() - RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
    if (new Date(dashboard.deleted_at).getTime() < cutoff) {
      return NextResponse.json({ error: `Dashboards can only be restored within ${RESTORE_WINDOW_DAYS} days of deletion` }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('dashboards')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .select(DASHBOARD_SELECT)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logDashboardActivity(
      supabase, organizationId, params.id, user.id,
      'restored',
      `Restored dashboard "${dashboard.name}"`
    )
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
