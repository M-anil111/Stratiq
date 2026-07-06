export const INVITE_EXPIRY_DAYS = 14

export const VALID_INVITE_ROLES = ['team_member', 'manager', 'admin', 'billing_admin', 'client']

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getAppUrl(requestOrigin?: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || requestOrigin || 'https://stratiqnow.com'
}

export function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function inviteEmailSubject(orgName: string): string {
  return `You've been invited to join ${orgName} on Stratiq`
}

export function inviteEmailHtml(orgName: string, inviteLink: string, role: string): string {
  const roleLabel = role.replace(/_/g, ' ')
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">You've been invited to join ${escapeHtml(orgName)}</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      You've been invited to join <strong>${escapeHtml(orgName)}</strong> on Stratiq as a <strong>${escapeHtml(roleLabel)}</strong>.
      Click the button below to accept the invitation and set up your account.
    </p>
    <p style="margin: 28px 0;">
      <a href="${inviteLink}" style="display: inline-block; background: #0ea5e9; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;">
        Accept invitation
      </a>
    </p>
    <p style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
      This invitation expires in ${INVITE_EXPIRY_DAYS} days. If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${inviteLink}" style="color: #0ea5e9;">${inviteLink}</a>
    </p>
    <p style="font-size: 12px; color: #94a3b8;">If you weren't expecting this invitation, you can safely ignore this email.</p>
  </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
