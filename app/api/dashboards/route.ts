import { NextRequest, NextResponse } from 'next/server'
import {
  getDashboardContext, validateDashboardName, templateWidgets,
  logDashboardActivity, defaultDashboardKey, canViewDashboard,
  ACCESS_LEVELS, RESTORE_WINDOW_DAYS,
} from './lib'

const DASHBOARD_SELECT = '*, owner:users!dashboards_owner_id_fkey(id, full_name, email)'

export async function GET(request: NextRequest) {
  const { supabase, user, organizationId, isAdmin } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const showDeleted = request.nextUrl.searchParams.get('deleted') === '1'

  if (showDeleted) {
    if (!isAdmin) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    const cutoff = new Date(Date.now() - RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('dashboards')
      .select(DASHBOARD_SELECT)
      .eq('organization_id', organizationId)
      .not('deleted_at', 'is', null)
      .gte('deleted_at', cutoff)
      .order('deleted_at', { ascending: false })

    if (error) {
      // 42P01 = undefined_table — migration 024 not applied in this environment
      if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ dashboards: data || [] })
  }

  const { data, error } = await supabase
    .from('dashboards')
    .select(DASHBOARD_SELECT)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Private dashboards are only visible to their owner (and admins)
  const dashboards = (data || []).filter((d: any) => canViewDashboard(d, user.id, isAdmin))

  // Per-user default dashboard, stored in organization_settings
  let defaultDashboardId: string | null = null
  try {
    const { data: setting } = await supabase
      .from('organization_settings')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('key', defaultDashboardKey(user.id))
      .maybeSingle()
    const value = setting?.value || null
    if (value && dashboards.some((d: any) => d.id === value)) defaultDashboardId = value
  } catch {
    // organization_settings unavailable — no default
  }

  return NextResponse.json({ dashboards, default_dashboard_id: defaultDashboardId })
}

export async function POST(request: NextRequest) {
  const { supabase, user, organizationId } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()

  const nameError = validateDashboardName(body.name)
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })
  const name = String(body.name).trim()

  const access = body.access && (ACCESS_LEVELS as readonly string[]).includes(body.access)
    ? body.access
    : 'everyone_edit'

  const template = typeof body.template === 'string' ? body.template : 'blank'
  let widgets = templateWidgets(template)
  // The create panel lets users include/exclude template widgets by type
  if (Array.isArray(body.widget_types)) {
    const wanted = body.widget_types.map(String)
    widgets = widgets.filter(w => wanted.includes(w.type))
  }

  const { data, error } = await supabase
    .from('dashboards')
    .insert({
      organization_id: organizationId,
      name,
      description: body.description ? String(body.description) : null,
      owner_id: user.id,
      access,
      widgets,
    })
    .select(DASHBOARD_SELECT)
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logDashboardActivity(
    supabase, organizationId, data.id, user.id,
    'created',
    `Created dashboard "${name}" from ${template} template with ${widgets.length} widget${widgets.length === 1 ? '' : 's'}`
  )

  return NextResponse.json(data, { status: 201 })
}
