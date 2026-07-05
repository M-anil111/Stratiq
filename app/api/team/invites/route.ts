import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'
import { sendEmail } from '@/lib/email'
import { getAppUrl, inviteEmailHtml, inviteEmailSubject, inviteExpiry } from '../_lib/invites'

// GET — list pending invites for the org (admin only). Token included so admins can copy invite links.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { data, error } = await supabase
    .from('team_invites')
    .select('id, email, role, invited_by, token, status, created_at, expires_at')
    .eq('organization_id', authz.organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json([]) // table not deployed yet
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

// DELETE ?id= — revoke a pending invite (admin only)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('team_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('organization_id', authz.organizationId)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Invites are not available yet' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// POST { id } — resend a pending invite: refresh expiry and re-send the email (admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: invite, error: fetchError } = await supabase
    .from('team_invites')
    .select('id, email, role, token, status')
    .eq('id', body.id)
    .eq('organization_id', authz.organizationId)
    .single()

  if (fetchError) {
    if (fetchError.code === '42P01') return NextResponse.json({ error: 'Invites are not available yet' }, { status: 503 })
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (!invite || invite.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending invites can be resent' }, { status: 400 })
  }

  const expires_at = inviteExpiry()
  const { error: updateError } = await supabase
    .from('team_invites')
    .update({ expires_at })
    .eq('id', invite.id)
    .eq('organization_id', authz.organizationId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', authz.organizationId)
    .single()
  const orgName = org?.name || 'your team'
  const appUrl = getAppUrl(request.nextUrl.origin)

  try {
    await sendEmail({
      to: invite.email,
      subject: inviteEmailSubject(orgName),
      html: inviteEmailHtml(orgName, `${appUrl}/login?invite=${invite.token}`, invite.role),
    })
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to send email: ${e?.message || 'unknown error'}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, expires_at })
}
