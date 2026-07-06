import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActingUser } from '@/lib/impersonation'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve the acting identity: when a Super Admin is "viewing as" another
  // user, the app reflects the impersonated user's id/name/role.
  const acting = await getActingUser(supabase)
  const effectiveId = acting?.id || user.id

  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, role, organization_id')
    .eq('id', effectiveId)
    .single()

  const base: Record<string, any> = data || {}

  // Theme preference lives in an optionally-present column (migration 040).
  // Fetch it separately so a missing column (42703) can't break this route.
  try {
    const { data: pref, error } = await supabase
      .from('users')
      .select('theme_preference')
      .eq('id', effectiveId)
      .single()
    if (!error && pref) base.theme_preference = (pref as any).theme_preference
  } catch {
    /* column may not exist yet — ignore */
  }

  if (acting?.impersonating) {
    // Real user's name for the banner / "return to your account" affordance.
    let realName: string | null = null
    try {
      const { data: realRow } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', acting.realUserId)
        .single()
      realName = realRow?.full_name || realRow?.email || null
    } catch {
      realName = null
    }

    return NextResponse.json({
      ...base,
      impersonating: true,
      acting_as: acting.targetName || (base as any).full_name || null,
      real_user: realName,
      real_user_id: acting.realUserId,
    })
  }

  return NextResponse.json({ ...base, impersonating: false })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const acting = await getActingUser(supabase)
  const effectiveId = acting?.id || user.id

  let body: any = {}
  try { body = await request.json() } catch { body = {} }

  // Currently the only user-editable field here is the theme preference.
  const theme = body?.theme_preference
  if (theme !== undefined) {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
      return NextResponse.json({ error: 'Invalid theme_preference' }, { status: 400 })
    }
    const { error } = await supabase
      .from('users')
      .update({ theme_preference: theme })
      .eq('id', effectiveId)
    // Tolerate a missing column (42703) so the client can still persist locally.
    if (error && error.code !== '42703') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
