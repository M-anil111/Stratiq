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

  const base = data || {}

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
