import { encrypt, decrypt } from '@/lib/encryption'

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || ''
}

export function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
}

export function googleScopes(): string {
  return GOOGLE_SCOPES.join(' ')
}

/** Resolve the app's base URL, preferring an explicit request origin. */
export function appBaseUrl(requestOrigin?: string | null): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    requestOrigin ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

export function googleRedirectUri(requestOrigin?: string | null): string {
  return `${appBaseUrl(requestOrigin)}/api/auth/google/callback`
}

/**
 * Tokens are stored encrypted (AES-256-GCM). Older rows may still be
 * plaintext, so fall back to the raw value when decryption fails.
 */
function readToken(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return decrypt(value)
  } catch {
    return value
  }
}

function storeToken(value: string): string {
  try {
    return encrypt(value)
  } catch {
    // If ENCRYPTION_KEY is missing we still want the flow to work.
    return value
  }
}

/**
 * Returns a valid (refreshed if needed) Google access token for the org.
 * Refreshes using the stored refresh_token, re-encrypts, and persists.
 * Returns null when Google isn't connected for the org.
 */
export async function getGoogleToken(supabase: any, orgId: string | null | undefined): Promise<string | null> {
  if (!orgId) return null

  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry'])

  const map: Record<string, string> = {}
  for (const row of rows || []) map[row.key] = row.value

  const accessToken = readToken(map.google_access_token)
  const refreshToken = readToken(map.google_refresh_token)
  if (!accessToken) return null

  const expiry = Number(map.google_token_expiry || 0)
  const expired = !expiry || Date.now() > expiry - 60_000

  if (expired && refreshToken) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: googleClientId(),
          client_secret: googleClientSecret(),
          refresh_token: refreshToken,
        }),
      })
      const tokens = await res.json()
      if (tokens.access_token) {
        const upserts: any[] = [
          { organization_id: orgId, key: 'google_access_token', value: storeToken(tokens.access_token) },
          { organization_id: orgId, key: 'google_token_expiry', value: String(Date.now() + (tokens.expires_in || 3600) * 1000) },
        ]
        if (tokens.refresh_token) {
          upserts.push({ organization_id: orgId, key: 'google_refresh_token', value: storeToken(tokens.refresh_token) })
        }
        await supabase.from('organization_settings').upsert(upserts, { onConflict: 'organization_id,key' })
        return tokens.access_token
      }
    } catch {
      // fall through to returning the (possibly stale) token
    }
  }

  return accessToken
}

/** Resolve the current user's organization id. */
export async function getOrgId(supabase: any): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  return data?.organization_id || null
}

export { storeToken as encryptGoogleToken }
