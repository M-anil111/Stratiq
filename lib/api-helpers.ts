import { createAdminClient } from './supabase/admin'

export async function createAuditLog({
  userId,
  organizationId,
  action,
  resourceType,
  resourceId,
  metadata,
  ipAddress,
  userAgent,
}: {
  userId?: string
  organizationId?: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}) {
  const supabase = createAdminClient()
  await supabase.from('audit_log').insert({
    user_id: userId,
    organization_id: organizationId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
    ip_address: ipAddress,
    user_agent: userAgent,
  })
}

export function getIpFromRequest(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
