import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { isValidPlatform } from '@/lib/social-oauth'

async function getOrgContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organizationId: null, role: null }
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  return {
    supabase,
    user,
    organizationId: userData?.organization_id || null,
    role: userData?.role || null,
  }
}

const MANAGER_ROLES = ['super_admin', 'admin', 'manager']

export async function GET(request: NextRequest) {
  const { supabase, user, organizationId } = await getOrgContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Never select raw tokens — only surface safe, display-only columns.
  const { data, error } = await supabase
    .from('social_accounts')
    .select('id, platform, account_name, account_handle, external_id, status, token_expires_at, created_at, connected_by')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    // 42P01 = undefined_table — migration 039 not applied in this environment.
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const { supabase, user, organizationId, role } = await getOrgContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!MANAGER_ROLES.includes(role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const platform = String(body.platform || '')
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }
  if (!body.account_name || !String(body.account_name).trim()) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  // Manual record (no OAuth): tokens stay null so publishing wiring knows this
  // account still needs its app credentials configured before it can post.
  const { data, error } = await supabase
    .from('social_accounts')
    .insert({
      organization_id: organizationId,
      platform,
      account_name: String(body.account_name).trim(),
      account_handle: body.account_handle ? String(body.account_handle).trim() : null,
      status: 'manual',
      connected_by: user.id,
    })
    .select('id, platform, account_name, account_handle, external_id, status, token_expires_at, created_at, connected_by')
    .single()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId,
    userId: user.id,
    action: 'social_account_added',
    entityType: 'social_account',
    entityId: data.id,
    detail: { platform, manual: true },
  })

  return NextResponse.json(data, { status: 201 })
}
