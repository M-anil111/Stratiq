import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyTurnstile } from '@/lib/turnstile'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const turnstileToken = formData.get('turnstileToken') as string | null

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing_fields', req.url), 303)
  }

  const humanVerified = await verifyTurnstile(turnstileToken, req.headers.get('x-forwarded-for') || undefined)
  if (!humanVerified) {
    return NextResponse.redirect(new URL('/login?error=verification_failed', req.url), 303)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const params = new URLSearchParams({ error: 'invalid_credentials' })
    return NextResponse.redirect(new URL(`/login?${params}`, req.url), 303)
  }

  return NextResponse.redirect(new URL('/dashboard', req.url), 303)
}
