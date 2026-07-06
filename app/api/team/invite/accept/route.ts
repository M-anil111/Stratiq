import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type InviteRow = {
  id: string
  email: string
  role: string | null
  status: string | null
  expires_at: string | null
  organization_id: string | null
  account_type: string | null
  project_access: string | null
  project_ids: string[] | null
}

// Missing-column-tolerant select: retry with a trimmed column list if migration 029
// (account_type/project_access/project_ids) hasn't been applied yet.
async function fetchInviteByToken(admin: ReturnType<typeof createAdminClient>, token: string) {
  const fullCols = 'id, email, role, status, expires_at, organization_id, account_type, project_access, project_ids'
  const cols = [fullCols, 'id, email, role, status, expires_at, organization_id']
  for (const c of cols) {
    const res = await admin.from('team_invites').select(c).eq('token', token).maybeSingle()
    if (!res.error) return { data: res.data as unknown as InviteRow | null, error: null as any }
    const missing = res.error.message?.match(/column [^ ]*"?([a-z_]+)"? does not exist/i)?.[1]
      || res.error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (res.error.code === '42P01') return { data: null, error: res.error }
    if (missing) continue
    return { data: null, error: res.error }
  }
  return { data: null, error: null as any }
}

function inviteIsValid(inv: InviteRow | null): inv is InviteRow {
  if (!inv) return false
  if ((inv.status || 'pending') !== 'pending') return false
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return false
  return true
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false })

  const admin = createAdminClient()
  const { data, error } = await fetchInviteByToken(admin, token)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ valid: false, unavailable: true })
    return NextResponse.json({ valid: false })
  }
  if (!inviteIsValid(data)) return NextResponse.json({ valid: false })

  return NextResponse.json({
    valid: true,
    email: data.email,
    role: data.role || 'team_member',
    account_type: data.account_type || (data.role === 'client' ? 'client' : 'user'),
  })
}

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string; full_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const token = (body.token || '').trim()
  const password = body.password || ''
  const fullName = (body.full_name || '').trim()

  if (!token) return NextResponse.json({ error: 'Missing invite token' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Validate the invite.
  const { data: invite, error: inviteError } = await fetchInviteByToken(admin, token)
  if (inviteError) {
    if (inviteError.code === '42P01') {
      return NextResponse.json({ error: 'Invitations are not available yet. Please contact your administrator.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not verify this invitation.' }, { status: 500 })
  }
  if (!inviteIsValid(invite)) {
    return NextResponse.json({ error: 'This invitation is invalid, expired, or has already been used.' }, { status: 400 })
  }

  const email = invite.email.toLowerCase()
  const role = invite.role || 'team_member'
  const orgId = invite.organization_id
  const accountType = invite.account_type || (role === 'client' ? 'client' : 'user')
  const projectAccess = invite.project_access === 'specific' ? 'specific' : 'all'
  const projectIds = Array.isArray(invite.project_ids) ? invite.project_ids.filter(Boolean) : []

  // 2. Create the auth user (or update the password if they already exist).
  let userId: string | null = null
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || undefined, organization_id: orgId, role },
    })
    if (createError) {
      const already = /already|registered|exists/i.test(createError.message || '')
      if (!already) {
        return NextResponse.json({ error: `Could not create account: ${createError.message}` }, { status: 500 })
      }
      // User exists — find them and update the password.
      let existing: { id: string; email?: string } | undefined
      for (let page = 1; page <= 20 && !existing; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        if (listErr) break
        existing = list?.users?.find(u => (u.email || '').toLowerCase() === email)
        if (!list || list.users.length < 200) break
      }
      if (!existing?.id) {
        return NextResponse.json({ error: 'An account already exists for this email but could not be updated.' }, { status: 500 })
      }
      userId = existing.id
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
      if (updErr) return NextResponse.json({ error: `Could not update account: ${updErr.message}` }, { status: 500 })
    } else {
      userId = created.user?.id || null
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Could not create account: ${e?.message || 'unknown error'}` }, { status: 500 })
  }

  if (!userId) return NextResponse.json({ error: 'Could not resolve the new account.' }, { status: 500 })

  // 3. Upsert the users row (missing-column tolerant).
  const userRecord: Record<string, any> = {
    id: userId,
    email,
    full_name: fullName || null,
    organization_id: orgId,
    role,
    project_access: projectAccess,
    is_active: true,
  }
  {
    let ok = false
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: upsertErr } = await admin.from('users').upsert(userRecord, { onConflict: 'id' })
      if (!upsertErr) { ok = true; break }
      if (upsertErr.code === '42P01') break
      const missing = upsertErr.message?.match(/Could not find the '([^']+)' column/)?.[1]
      if (missing && missing in userRecord) { delete userRecord[missing]; continue }
      return NextResponse.json({ error: `Could not set up your profile: ${upsertErr.message}` }, { status: 500 })
    }
    if (!ok) {
      return NextResponse.json({ error: 'Your workspace profile could not be created. Please contact your administrator.' }, { status: 503 })
    }
  }

  // 4. Client portal linkage (best-effort). Portal clients are keyed by client_portal_access.
  if (accountType === 'client' || role === 'client') {
    try {
      const { data: client } = await admin
        .from('clients')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('email', email)
        .maybeSingle()
      if (client?.id) {
        await admin
          .from('client_portal_access')
          .upsert({ client_id: client.id, user_id: userId }, { onConflict: 'client_id,user_id' })
      }
    } catch {
      // clients/client_portal_access table or column missing — non-fatal.
    }
  }

  // 5. Specific project access (best-effort).
  if (projectAccess === 'specific' && projectIds.length > 0 && orgId) {
    try {
      await admin.from('user_project_access').upsert(
        projectIds.map(pid => ({ organization_id: orgId, user_id: userId, project_id: pid })),
        { onConflict: 'user_id,project_id' }
      )
    } catch {
      // migration 029 not applied — non-fatal.
    }
  }

  // 6. Mark the invite accepted (best-effort — the account already exists).
  try {
    await admin.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id)
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true })
}
