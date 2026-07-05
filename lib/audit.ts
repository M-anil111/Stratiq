import type { SupabaseClient } from '@supabase/supabase-js'

export interface LogAuditParams {
  organizationId?: string | null
  userId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  detail?: Record<string, unknown> | null
}

/**
 * Best-effort audit log writer. Inserts a row into `audit_log` and swallows
 * all errors (including 42P01 when the table is absent) so it never breaks
 * the calling request handler.
 */
export async function logAudit(
  supabase: SupabaseClient,
  { organizationId, userId, action, entityType, entityId, detail }: LogAuditParams
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      organization_id: organizationId ?? null,
      user_id: userId ?? null,
      action,
      resource_type: entityType ?? null,
      resource_id: entityId ?? null,
      metadata: detail ?? null,
    })
    if (error && error.code !== '42P01') {
      console.error('logAudit insert failed:', error.message)
    }
  } catch (err: any) {
    // Never let audit logging break the caller.
    if (err?.code !== '42P01') {
      console.error('logAudit insert failed:', err?.message || err)
    }
  }
}
