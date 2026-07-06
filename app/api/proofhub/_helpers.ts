import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ProofHubError, proofhubConfigured } from '@/lib/proofhub'

// Ensure a Stratiq user is signed in. Returns the user or a NextResponse to
// short-circuit with.
export async function requireStratiqUser() {
  const user = await getCurrentUser().catch(() => null)
  if (!user) {
    return { user: null, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, res: null as NextResponse | null }
}

// When env vars are missing, every route returns a clear configured:false.
export function notConfigured() {
  return NextResponse.json({ configured: false }, { status: 200 })
}

export function ensureConfigured() {
  return proofhubConfigured()
}

// Translate any thrown error into friendly JSON (never crash the route).
export function phErrorResponse(e: unknown) {
  if (e instanceof ProofHubError) {
    const status = e.status >= 400 && e.status < 600 ? e.status : 502
    return NextResponse.json(
      { error: 'ProofHub request failed', message: e.message, status: e.status, detail: e.detail },
      { status }
    )
  }
  return NextResponse.json(
    { error: 'Unexpected error', message: String(e) },
    { status: 500 }
  )
}
