import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Verify client belongs to org
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const now = new Date()
  const month: string = body.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month format, expected YYYY-MM' }, { status: 400 })
  }

  const token = `${crypto.randomUUID().replace(/-/g, '')}${randomBytes(16).toString('hex')}`
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('report_share_tokens').insert({
    organization_id: userData.organization_id,
    client_id: params.id,
    token,
    month,
    created_by: user.id,
    expires_at: expiresAt,
  })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Share links not set up — run migration 019' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ url: '/share/report/' + token })
}
