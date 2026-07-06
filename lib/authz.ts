import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_ROLES = ['admin']
export const MANAGER_ROLES = ['admin', 'manager']
export const BILLING_ROLES = ['admin', 'billing_admin']

export type RequireRoleResult =
  | { ok: true; organizationId: string; role: string }
  | { ok: false }

/**
 * Server-side role check. Fetches the user's role + organization_id and
 * verifies the role is allowed. Admins (and legacy super_admins) always pass.
 * Frontend role checks are UX only — every destructive/sensitive API handler
 * must call this (or an equivalent inline check) before acting.
 */
export async function requireRole(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  roles: string[]
): Promise<RequireRoleResult> {
  const { data, error } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', userId)
    .single()

  if (error || !data?.organization_id || !data?.role) return { ok: false }

  const isAdmin = data.role === 'admin' || data.role === 'super_admin'
  if (!isAdmin && !roles.includes(data.role)) return { ok: false }

  return { ok: true, organizationId: data.organization_id, role: data.role }
}
