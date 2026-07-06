// Central notification system.
//
// Writes in-app notifications (notifications table) and optionally emails the
// recipient. Every helper is best-effort and swallows errors so a notification
// failure can never break the flow that triggered it (e.g. a publish). Degrades
// gracefully if the notifications table hasn't been migrated yet (42P01).

import { sendEmail } from '@/lib/email'

export type NotificationType =
  | 'publish_failed'
  | 'publish_success'
  | 'token_expiry'
  | 'reconnect'
  | 'approval_needed'
  | 'report'
  | 'info'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export type NotifyInput = {
  organizationId?: string | null
  userIds: string[]              // in-app recipients (users.id)
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  body?: string
  link?: string
  entityType?: string
  entityId?: string
  email?: {                      // optional email fan-out
    to: string | string[]
    subject?: string
  }
}

/**
 * Create in-app notifications for one or more users, and optionally send an
 * email. Never throws — returns { created } best-effort.
 */
export async function notify(supabase: any, input: NotifyInput): Promise<{ created: number }> {
  const {
    organizationId = null,
    userIds = [],
    type,
    severity = defaultSeverity(type),
    title,
    body = null,
    link = null,
    entityType = null,
    entityId = null,
    email,
  } = input

  let created = 0

  const rows = (userIds || []).filter(Boolean).map((uid) => ({
    organization_id: organizationId,
    user_id: uid,
    type,
    severity,
    title,
    body,
    link,
    entity_type: entityType,
    entity_id: entityId,
  }))

  if (rows.length > 0) {
    try {
      const { data, error } = await supabase.from('notifications').insert(rows).select('id')
      if (!error) created = (data || []).length
      // 42P01 (table missing) and other errors are swallowed intentionally.
    } catch { /* noop */ }
  }

  if (email?.to) {
    try {
      await sendEmail({
        to: email.to,
        subject: email.subject || title,
        html: emailHtml(title, body, link, severity),
      })
    } catch { /* email is best-effort */ }
  }

  return { created }
}

/** Notify all org admins/managers (used for system events like publish failures). */
export async function notifyOrgManagers(
  supabase: any,
  organizationId: string,
  input: Omit<NotifyInput, 'userIds' | 'organizationId'> & { alsoEmail?: boolean },
): Promise<{ created: number }> {
  let userIds: string[] = []
  let emails: string[] = []
  try {
    const { data } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('organization_id', organizationId)
      .in('role', ['super_admin', 'admin', 'manager'])
    userIds = (data || []).map((u: any) => u.id)
    emails = (data || []).map((u: any) => u.email).filter(Boolean)
  } catch { /* noop */ }

  const { alsoEmail, ...rest } = input
  return notify(supabase, {
    ...rest,
    organizationId,
    userIds,
    email: alsoEmail && emails.length ? { to: emails, subject: input.title } : undefined,
  })
}

function defaultSeverity(type: NotificationType): NotificationSeverity {
  switch (type) {
    case 'publish_failed': return 'error'
    case 'publish_success': return 'success'
    case 'token_expiry':
    case 'reconnect':
    case 'approval_needed': return 'warning'
    default: return 'info'
  }
}

function emailHtml(title: string, body: string | null, link: string | null, severity: NotificationSeverity) {
  const color = severity === 'error' ? '#ef4444' : severity === 'success' ? '#10b981' : severity === 'warning' ? '#f59e0b' : '#0ea5e9'
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  const href = link ? (link.startsWith('http') ? link : `${base}${link}`) : null
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="border-left:4px solid ${color};padding:16px 20px;background:#f8fafc;border-radius:8px">
      <h2 style="margin:0 0 8px;font-size:17px;color:#0f172a">${escapeHtml(title)}</h2>
      ${body ? `<p style="margin:0;color:#475569;font-size:14px;line-height:1.5">${escapeHtml(body)}</p>` : ''}
      ${href ? `<p style="margin:16px 0 0"><a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px;font-weight:600">View in Stratiq</a></p>` : ''}
    </div>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">Stratiq — Mindshare Consulting</p>
  </div>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}
