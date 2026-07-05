import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'
import { sendEmail } from '@/lib/email'
import {
  EMAIL_RE,
  VALID_INVITE_ROLES,
  getAppUrl,
  inviteEmailHtml,
  inviteEmailSubject,
  inviteExpiry,
} from '../_lib/invites'

type InviteResult = { email: string; reason?: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  let body: { email?: string; emails?: string[]; full_name?: string; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const role = body.role && VALID_INVITE_ROLES.includes(body.role) ? body.role : 'team_member'
  const rawEmails: string[] = Array.isArray(body.emails)
    ? body.emails
    : body.email
      ? [body.email]
      : []

  if (rawEmails.length === 0) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (rawEmails.length > 100) {
    return NextResponse.json({ error: 'A maximum of 100 invites can be sent at once' }, { status: 400 })
  }

  const orgId = userData.organization_id
  const appUrl = getAppUrl(request.nextUrl.origin)

  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
  const orgName = org?.name || 'your team'

  // Existing org members — skip them
  const { data: existingMembers } = await supabase
    .from('users')
    .select('email')
    .eq('organization_id', orgId)
  const memberEmails = new Set(
    (existingMembers || []).map((m: { email: string | null }) => (m.email || '').toLowerCase()).filter(Boolean)
  )

  const sent: InviteResult[] = []
  const skipped: InviteResult[] = []
  const errors: InviteResult[] = []
  const seen = new Set<string>()

  for (const raw of rawEmails) {
    const email = String(raw || '').trim().toLowerCase()
    if (!email) continue
    if (seen.has(email)) {
      skipped.push({ email, reason: 'Duplicate in request' })
      continue
    }
    seen.add(email)

    if (!EMAIL_RE.test(email)) {
      errors.push({ email, reason: 'Invalid email format' })
      continue
    }
    if (memberEmails.has(email)) {
      skipped.push({ email, reason: 'Already a member of this organization' })
      continue
    }

    const token = crypto.randomBytes(32).toString('hex')
    const { error: insertError } = await supabase.from('team_invites').insert({
      organization_id: orgId,
      email,
      role,
      invited_by: user.id,
      token,
      status: 'pending',
      expires_at: inviteExpiry(),
    })

    if (insertError) {
      if (insertError.code === '42P01') {
        // team_invites table not deployed yet — fall back to the legacy single-invite flow
        const legacy = await legacyInvite(supabase, orgId, email, body.full_name || '', role)
        if (legacy.ok) sent.push({ email })
        else errors.push({ email, reason: legacy.error })
        continue
      }
      if (insertError.code === '23505') {
        skipped.push({ email, reason: 'An invite is already pending for this email' })
        continue
      }
      errors.push({ email, reason: insertError.message })
      continue
    }

    try {
      await sendEmail({
        to: email,
        subject: inviteEmailSubject(orgName),
        html: inviteEmailHtml(orgName, `${appUrl}/login?invite=${token}`, role),
      })
      sent.push({ email })
    } catch (e: any) {
      // Invite row exists (copy-link still works), but the email failed to deliver
      errors.push({ email, reason: `Invite created but email failed to send: ${e?.message || 'unknown error'}` })
    }
  }

  return NextResponse.json({ success: errors.length === 0, sent, skipped, errors }, { status: 201 })
}

/**
 * Legacy behavior (pre-team_invites): Supabase auth admin invite + users upsert.
 * Used only when the team_invites table does not exist (42P01).
 */
async function legacyInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  email: string,
  fullName: string,
  role: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      organization_id: organizationId,
      role,
      full_name: fullName,
    },
  })

  if (inviteError && !inviteError.message.includes('already been registered')) {
    return { ok: false, error: inviteError.message }
  }

  const record = {
    email,
    full_name: fullName,
    role,
    organization_id: organizationId,
    status: 'invited',
    created_at: new Date().toISOString(),
  }

  const { error: upsertError } = await supabase.from('users').upsert(record, { onConflict: 'email' })
  if (upsertError) {
    const { error: insertError } = await supabase.from('users').insert(record)
    if (insertError) return { ok: false, error: insertError.message }
  }
  return { ok: true }
}
