import { sendEmail } from '@/lib/email/index'

type PortalNotifyType = 'message' | 'report' | 'invoice'

const PORTAL_PATHS: Record<PortalNotifyType, string> = {
  message: '/portal/messages',
  report: '/portal/reports',
  invoice: '/portal/invoices',
}

const TYPE_LABELS: Record<PortalNotifyType, string> = {
  message: 'message',
  report: 'report',
  invoice: 'invoice',
}

/**
 * Resolve the portal contact email for a client:
 *  1. The email of a user linked via client_portal_access
 *  2. Falling back to the client's primary email
 * Returns null if none can be resolved (or tables are missing).
 */
async function resolvePortalEmail(supabase: any, clientId: string): Promise<string | null> {
  // Portal user email (client_portal_access -> users.email)
  try {
    const { data: access } = await supabase
      .from('client_portal_access')
      .select('user_id, users(email)')
      .eq('client_id', clientId)
      .limit(1)
    const row = Array.isArray(access) ? access[0] : access
    const portalEmail = row?.users?.email || (Array.isArray(row?.users) ? row.users[0]?.email : undefined)
    if (portalEmail) return portalEmail
  } catch {
    // table/column missing — fall through
  }

  // Fallback: client's primary email
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('email')
      .eq('id', clientId)
      .single()
    if (client?.email) return client.email
  } catch {
    // ignore
  }

  return null
}

/**
 * Best-effort portal login nudge. Emails the client's portal contact to let them
 * know staff has sent them something new. Never throws — swallows all errors so it
 * can be safely fire-and-forget from any route.
 */
export async function notifyPortalClient(
  supabase: any,
  opts: {
    clientId: string
    type: PortalNotifyType
    summary?: string
    appUrl?: string
    /** Skip if the portal email matches this address (dedupe against an existing send). */
    skipIfEmail?: string
  }
): Promise<{ notified: boolean }> {
  try {
    const { clientId, type, summary, appUrl, skipIfEmail } = opts
    if (!clientId) return { notified: false }

    const to = await resolvePortalEmail(supabase, clientId)
    if (!to) return { notified: false }

    if (skipIfEmail && to.trim().toLowerCase() === skipIfEmail.trim().toLowerCase()) {
      return { notified: false }
    }

    const label = TYPE_LABELS[type]
    const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const link = `${base}${PORTAL_PATHS[type]}`

    const summaryBlock = summary
      ? `<p style="color:#334155;font-size:15px;line-height:1.5;background:#f1f5f9;border-radius:8px;padding:14px 16px;margin:0 0 24px">${summary}</p>`
      : ''

    const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:24px 32px">
        <h1 style="margin:0;font-size:20px;color:#fff">New ${label} in your Stratiq portal</h1>
      </div>
      <div style="padding:32px">
        <p style="color:#334155;font-size:15px;margin:0 0 20px">You have a new ${label} waiting for you. Log in to your portal to view it.</p>
        ${summaryBlock}
        <div style="text-align:center;margin:8px 0 4px">
          <a href="${link}" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none">View in portal</a>
        </div>
      </div>
    </div>`

    await sendEmail({
      to,
      subject: `New ${label} in your Stratiq portal`,
      html,
    })

    return { notified: true }
  } catch {
    // best-effort: never break the caller
    return { notified: false }
  }
}
