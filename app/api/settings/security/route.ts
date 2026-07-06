import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current_password, new_password } = await request.json()
  if (!new_password || new_password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 })
  if (!current_password) return NextResponse.json({ error: 'Current password is required' }, { status: 400 })

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email!, password: current_password })
  if (signInError) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const { error } = await supabase.auth.updateUser({ password: new_password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
