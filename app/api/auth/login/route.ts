import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing_fields', req.url), 303)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const params = new URLSearchParams({ error: 'invalid_credentials' })
    return NextResponse.redirect(new URL(`/login?${params}`, req.url), 303)
  }

  return NextResponse.redirect(new URL('/dashboard', req.url), 303)
}
