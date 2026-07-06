import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * App-level "View as another user" (HubSpot-style "Log in as").
 *
 * Supabase auth sessions can't be swapped server-side, so this is NOT a real
 * auth session switch. Instead a Super Admin's real, authenticated session is
 * preserved and we layer an "acting identity" on top via a signed cookie.
 * Data in Stratiq is org-shared; impersonation changes the acting user's
 * id/role for UI and assignment-scoped views only. Every request still verifies
 * the REAL authenticated user is a super_admin before honoring the cookie, so a
 * leaked cookie alone can never escalate privileges.
 */

export const IMPERSONATION_COOKIE = 'sq_impersonate'

// 30 minutes.
export const IMPERSONATION_TTL_MS = 30 * 60 * 1000

export interface ImpersonationPayload {
  realUserId: string
  targetUserId: string
  orgId: string
  exp: number // epoch ms
}

export interface ActingUser {
  id: string
  organizationId: string | null
  role: string | null
  impersonating: boolean
  realUserId?: string
  targetName?: string | null
}

// Roles that may never be impersonated.
const PROTECTED_TARGET_ROLES = ['super_admin', 'billing_admin']

function getSecret(): string {
  // Reuse ENCRYPTION_KEY as the HMAC secret; fall back to a dedicated var.
  return process.env.ENCRYPTION_KEY || process.env.IMPERSONATION_SECRET || ''
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(data: string): Promise<string> {
  const secret = getSecret()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64url(new Uint8Array(sig))
}

/** Constant-time-ish string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Sign an impersonation payload into a `<body>.<sig>` cookie value using an
 * HMAC over the JSON body. Web Crypto keeps this usable from the Edge runtime.
 */
export async function signImpersonation(payload: ImpersonationPayload): Promise<string> {
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmac(body)
  return `${body}.${sig}`
}

/**
 * Verify a signed cookie value. Returns the payload if the signature is valid
 * and the payload has not expired; otherwise null. Never throws.
 */
export async function verifyImpersonation(cookieValue: string | undefined | null): Promise<ImpersonationPayload | null> {
  try {
    if (!cookieValue || !getSecret()) return null
    const dot = cookieValue.lastIndexOf('.')
    if (dot <= 0) return null
    const body = cookieValue.slice(0, dot)
    const sig = cookieValue.slice(dot + 1)
    const expected = await hmac(body)
    if (!safeEqual(sig, expected)) return null

    const json = new TextDecoder().decode(fromBase64url(body))
    const payload = JSON.parse(json) as ImpersonationPayload
    if (
      !payload ||
      typeof payload.realUserId !== 'string' ||
      typeof payload.targetUserId !== 'string' ||
      typeof payload.orgId !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null
    }
    if (Date.now() >= payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/** True when a target role can be impersonated (not super/billing admin). */
export function isImpersonableRole(role: string | null | undefined): boolean {
  return !!role && !PROTECTED_TARGET_ROLES.includes(role)
}

/**
 * Resolve the acting user for a request.
 *
 * Returns the real authenticated user by default. If a valid `sq_impersonate`
 * cookie is present AND the real user is still a super_admin AND the cookie's
 * realUserId matches the authenticated user AND it hasn't expired, returns the
 * TARGET user's identity/role with `impersonating: true`.
 *
 * Fail-safe: any error resolves to the real user (or a bare unauthenticated
 * shape when there is no session).
 */
export async function getActingUser(supabase: SupabaseClient<any, any, any>): Promise<ActingUser | null> {
  let realUserId: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    realUserId = user.id

    const { data: realData } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const real: ActingUser = {
      id: user.id,
      organizationId: realData?.organization_id ?? null,
      role: realData?.role ?? null,
      impersonating: false,
    }

    // Only super_admins may act as another user.
    if (real.role !== 'super_admin') return real

    // Read the cookie via the shared cookie store used by the supabase server client.
    let cookieValue: string | undefined
    try {
      const { cookies } = await import('next/headers')
      const store = await cookies()
      cookieValue = store.get(IMPERSONATION_COOKIE)?.value
    } catch {
      cookieValue = undefined
    }
    if (!cookieValue) return real

    const payload = await verifyImpersonation(cookieValue)
    // Cookie is only honored for the same real user (leaked cookie can't escalate).
    if (!payload || payload.realUserId !== user.id) return real

    const { data: target } = await supabase
      .from('users')
      .select('organization_id, role, full_name, email')
      .eq('id', payload.targetUserId)
      .single()

    // Re-validate the target still qualifies (same org, impersonable role).
    if (
      !target ||
      target.organization_id !== real.organizationId ||
      !isImpersonableRole(target.role)
    ) {
      return real
    }

    return {
      id: payload.targetUserId,
      organizationId: target.organization_id ?? real.organizationId,
      role: target.role ?? null,
      impersonating: true,
      realUserId: user.id,
      targetName: target.full_name || target.email || null,
    }
  } catch {
    // Fail safe: never let impersonation resolution break a request.
    if (realUserId) {
      return { id: realUserId, organizationId: null, role: null, impersonating: false }
    }
    return null
  }
}
