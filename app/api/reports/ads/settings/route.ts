import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'

export const dynamic = 'force-dynamic'

const SETTING_KEYS = ['ads_roi_mode', 'ads_avg_sale_price', 'ads_conversion_rate'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const defaults = {
    ads_roi_mode: 'revenue' as 'revenue' | 'estimate',
    ads_avg_sale_price: 0,
    ads_conversion_rate: 0,
  }

  const { data, error } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', userData.organization_id)
    .in('key', SETTING_KEYS as unknown as string[])

  if (error) {
    // 42P01: settings table not migrated yet — return defaults gracefully
    if ((error as any).code === '42P01') {
      return NextResponse.json({ ...defaults, is_admin: ['admin', 'super_admin'].includes(userData.role) })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result: Record<string, any> = { ...defaults }
  for (const row of data || []) {
    if (row.key === 'ads_roi_mode' && (row.value === 'revenue' || row.value === 'estimate')) {
      result.ads_roi_mode = row.value
    }
    if (row.key === 'ads_avg_sale_price') result.ads_avg_sale_price = Number(row.value) || 0
    if (row.key === 'ads_conversion_rate') result.ads_conversion_rate = Number(row.value) || 0
  }

  return NextResponse.json({ ...result, is_admin: ['admin', 'super_admin'].includes(userData.role) })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  const upserts: { organization_id: string; key: string; value: string; updated_at: string }[] = []
  const now = new Date().toISOString()

  if ('ads_roi_mode' in body) {
    if (!['revenue', 'estimate'].includes(body.ads_roi_mode)) {
      return NextResponse.json({ error: 'ads_roi_mode must be "revenue" or "estimate"' }, { status: 400 })
    }
    upserts.push({ organization_id: auth.organizationId, key: 'ads_roi_mode', value: body.ads_roi_mode, updated_at: now })
  }
  if ('ads_avg_sale_price' in body) {
    const n = Number(body.ads_avg_sale_price)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'ads_avg_sale_price must be a non-negative number' }, { status: 400 })
    }
    upserts.push({ organization_id: auth.organizationId, key: 'ads_avg_sale_price', value: String(n), updated_at: now })
  }
  if ('ads_conversion_rate' in body) {
    const n = Number(body.ads_conversion_rate)
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return NextResponse.json({ error: 'ads_conversion_rate must be between 0 and 1' }, { status: 400 })
    }
    upserts.push({ organization_id: auth.organizationId, key: 'ads_conversion_rate', value: String(n), updated_at: now })
  }

  if (upserts.length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('organization_settings')
    .upsert(upserts, { onConflict: 'organization_id,key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
