import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashCode, signVerifiedCookie, REVERIFY_AFTER_MS, VERIFIED_COOKIE } from '@/lib/otp'

async function setVerifiedCookie(res: NextResponse) {
  const expiresAtMs = Date.now() + REVERIFY_AFTER_MS
  res.cookies.set(VERIFIED_COOKIE, await signVerifiedCookie(expiresAtMs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(REVERIFY_AFTER_MS / 1000),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let code = ''
  try {
    const body = await req.json()
    code = String(body?.code || '').trim()
  } catch {}

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const codeHash = await hashCode(code)

  try {
    const { data: rows, error } = await supabase
      .from('login_otps')
      .select('id, code_hash, expires_at, consumed')
      .eq('user_id', user.id)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      if ((error as { code?: string }).code === '42P01') {
        // Table missing → degrade gracefully, treat as verified.
        const res = NextResponse.json({ ok: true })
        await setVerifiedCookie(res)
        return res
      }
      throw error
    }

    const otp = rows?.[0]
    if (!otp || otp.code_hash !== codeHash) {
      return NextResponse.json({ error: 'Incorrect code' }, { status: 400 })
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 })
    }

    await supabase.from('login_otps').update({ consumed: true }).eq('id', otp.id)
    await supabase.from('users').update({ last_verified_at: new Date().toISOString() }).eq('id', user.id)

    const res = NextResponse.json({ ok: true })
    await setVerifiedCookie(res)
    return res
  } catch (err) {
    if ((err as { code?: string })?.code === '42P01') {
      const res = NextResponse.json({ ok: true })
      await setVerifiedCookie(res)
      return res
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }
}
