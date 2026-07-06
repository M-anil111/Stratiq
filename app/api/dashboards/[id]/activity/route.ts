import { NextRequest, NextResponse } from 'next/server'
import { getDashboardContext, canViewDashboard } from '../../lib'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, organizationId, isAdmin } = await getDashboardContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: dashboard, error: fetchError } = await supabase
    .from('dashboards')
    .select('id, name, access, owner_id')
    .eq('id', params.id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (fetchError) {
    // 42P01 = undefined_table — migration 024 not applied in this environment
    if (fetchError.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canViewDashboard(dashboard, user.id, isAdmin)) {
    return NextResponse.json({ error: 'This dashboard is private' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('dashboard_activity')
    .select('id, action, detail, created_at, user:users!dashboard_activity_user_id_fkey(id, full_name, email)')
    .eq('organization_id', organizationId)
    .eq('dashboard_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
