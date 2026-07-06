import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'
import { logAudit } from '@/lib/audit'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { siteId } = await params
  const body = await request.json()
  const { url, category, da_score } = body

  let domain = url
  try {
    domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {}

  const { data, error } = await supabase
    .from('directory_sites')
    .update({ url, domain, category, da_score: da_score ?? null, updated_at: new Date().toISOString() })
    .eq('id', siteId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: authz.organizationId,
    userId: user.id,
    action: 'directory_site_updated',
    entityType: 'directory_site',
    entityId: siteId,
    detail: { url, category },
  })

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { siteId } = await params

  const { error } = await supabase.from('directory_sites').delete().eq('id', siteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: authz.organizationId,
    userId: user.id,
    action: 'directory_site_deleted',
    entityType: 'directory_site',
    entityId: siteId,
  })

  return NextResponse.json({ success: true })
}
