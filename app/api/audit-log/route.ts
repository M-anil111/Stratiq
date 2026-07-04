import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const url = request.nextUrl
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)
  const offset = Number(url.searchParams.get('offset') || 0)
  const search = url.searchParams.get('search') || ''
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''

  let query = supabase
    .from('audit_log')
    .select('id, action, user_id, ip_address, details, created_at, resource_type, resource_id, metadata, users(email)', { count: 'exact' })
    .eq('organization_id', userData.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`action.ilike.%${search}%,users.email.ilike.%${search}%`)
  }
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')

  const { data, error, count } = await query

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ entries: [], total: 0 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const entries = (data || []).map((row: any) => ({
    id: row.id,
    action: row.action,
    user_email: row.users?.email || null,
    resource_type: row.resource_type || null,
    resource_id: row.resource_id || null,
    metadata: row.metadata || row.details || null,
    created_at: row.created_at,
    ip_address: row.ip_address || null,
  }))

  return NextResponse.json({ entries, total: count ?? entries.length })
}
