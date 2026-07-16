// Server-side verification for Cloudflare Turnstile tokens.
// Degrades to a no-op pass when TURNSTILE_SECRET_KEY isn't configured, so the
// app works before the Cloudflare widget is set up.
export function turnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY
}

export async function verifyTurnstile(token: string | null | undefined, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteip) body.set('remoteip', remoteip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    return !!data.success
  } catch {
    // Cloudflare unreachable — fail open rather than locking users out.
    return true
  }
}
