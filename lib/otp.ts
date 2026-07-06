// Edge-safe OTP helpers. Uses Web Crypto (globalThis.crypto.subtle) so this
// module can be imported from both Edge middleware and Node route handlers.

// Re-verify (step-up auth) window. After this long since last verification,
// the user is asked to enter an emailed code again.
export const REVERIFY_AFTER_MS = 12 * 60 * 60 * 1000 // 12 hours

// How long an emailed code stays valid.
export const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

export const VERIFIED_COOKIE = 'sq_verified'

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateCode(): string {
  // 6-digit numeric code, zero-padded.
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export function needsReverify(lastVerifiedAt: string | Date | null | undefined): boolean {
  if (!lastVerifiedAt) return true
  const t = typeof lastVerifiedAt === 'string' ? Date.parse(lastVerifiedAt) : lastVerifiedAt.getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t > REVERIFY_AFTER_MS
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const shown = local.slice(0, 1)
  return `${shown}${'•'.repeat(Math.max(3, local.length - 1))}@${domain}`
}

function cookieSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'stratiq-otp-fallback-secret'
  )
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(cookieSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toHex(sig)
}

// Signed cookie value = "<expiresAtMs>.<hmac>" so middleware can verify
// integrity and expiry without a DB query.
export async function signVerifiedCookie(expiresAtMs: number): Promise<string> {
  const payload = String(expiresAtMs)
  const sig = await hmac(payload)
  return `${payload}.${sig}`
}

export async function verifyVerifiedCookie(value: string | undefined | null): Promise<boolean> {
  if (!value) return false
  const idx = value.lastIndexOf('.')
  if (idx <= 0) return false
  const payload = value.slice(0, idx)
  const sig = value.slice(idx + 1)
  const expected = await hmac(payload)
  if (sig.length !== expected.length) return false
  // Constant-time-ish comparison.
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return false
  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt)) return false
  return Date.now() < expiresAt
}
