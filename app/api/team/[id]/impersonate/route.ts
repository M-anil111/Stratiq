import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_MS,
  isImpersonableRole,
  signImpersonation,
} from '@/lib/impersonation'

/**
 * App-level "View as another user" (HubSpot-style). This does NOT swap the
 * Supabase auth session — the Super Admin stays authenticated as themselves.
 * A signed, httpOnly cookie records the acting identity, and every request
 * re-verifies the real user is still a super_admin before honoring it.
 */

// POST — start impersonation. Super Admin only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the REAL authenticated user's role every request.
  const { data: realData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!realData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (realData.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can view as another user' }, { status: 403 })
  }

  const targetId = params.id
  if (targetId === user.id) {
    return NextResponse.json({ error: 'You cannot view as yourself' }, { status: 400 })
  }

  // Load the target, scoped to the same org (rejects cross-org automatically).
  let target: any = null
  try {
    // Prefer selecting status/is_active for the accepted-invite check; degrade
    // gracefully if those columns are absent.
    const cols = ['id, organization_id, role, full_name, email, status, is_active', 'id, organization_id, role, full_name, email']
    for (const c of cols) {
      const { data, error } = await supabase
        .from('users')
        .select(c)
        .eq('id', targetId)
        .eq('organization_id', realData.organization_id)
        .single()
      if (!error) { target = data; break }
      // Unknown column -> retry with the minimal set.
      if (error.code === '42703' || /column/i.test(error.message || '')) continue
      break
    }
  } catch {
    target = null
  }

  if (!target) return NextResponse.json({ error: 'User not found in your organization' }, { status: 404 })

  // Cannot impersonate a super_admin or billing_admin.
  if (!isImpersonableRole(target.role)) {
    return NextResponse.json({ error: 'This user’s role cannot be viewed as' }, { status: 403 })
  }

  // Best-effort: reject users who have not accepted their invite (no auth account yet).
  if (target.status === 'invited' || target.is_active === false) {
    return NextResponse.json({ error: 'This user has not accepted their invite yet' }, { status: 403 })
  }

  const targetName = target.full_name || target.email || 'a user'

  const cookieValue = await signImpersonation({
    realUserId: user.id,
    targetUserId: targetId,
    orgId: realData.organization_id,
    exp: Date.now() + IMPERSONATION_TTL_MS,
  })

  await logAudit(supabase, {
    organizationId: realData.organization_id,
    userId: user.id,
    action: 'impersonate_start',
    entityType: 'user',
    entityId: targetId,
    detail: { detail: `Super admin viewing as ${targetName}` },
  })

  // Notify the target that a Super Admin accessed their account. Best-effort.
  if (target.email) {
    try {
      await sendEmail({
        to: target.email,
        subject: 'A Super Admin accessed your account',
        html: `<div style="font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.6;">
          <p>Hi ${target.full_name || 'there'},</p>
          <p>A Super Admin accessed your account to provide support. They are temporarily viewing Stratiq as you to troubleshoot or verify access.</p>
          <p>All actions taken during this session are logged. If you did not expect this, please contact your organization administrator.</p>
          <p style="color: #64748b; font-size: 12px;">This is an automated message from Stratiq.</p>
        </div>`,
      })
    } catch {
      // Never let email delivery block the support session.
    }
  }

  const res = NextResponse.json({ ok: true, target: { id: targetId, name: targetName } })
  res.cookies.set(IMPERSONATION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(IMPERSONATION_TTL_MS / 1000),
  })
  return res
}

// DELETE — end impersonation. Clears the cookie.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let organizationId: string | null = null
  try {
    const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    organizationId = data?.organization_id ?? null
  } catch {
    organizationId = null
  }

  await logAudit(supabase, {
    organizationId,
    userId: user.id,
    action: 'impersonate_end',
    entityType: 'user',
    entityId: params.id,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(IMPERSONATION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
