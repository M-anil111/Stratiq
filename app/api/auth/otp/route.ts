import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { generateCode, hashCode, maskEmail, OTP_EXPIRY_MS, signVerifiedCookie, VERIFIED_COOKIE, REVERIFY_AFTER_MS } from '@/lib/otp'

// When the OTP layer can't run (table missing before migration, email failure,
// etc.) we must NOT trap the user: return unavailable AND set the verified
// cookie so middleware lets them through instead of looping back to /verify.
async function unavailableResponse() {
  const res = NextResponse.json({ sent: false, unavailable: true })
  res.cookies.set(VERIFIED_COOKIE, await signVerifiedCookie(Date.now() + REVERIFY_AFTER_MS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(REVERIFY_AFTER_MS / 1000),
  })
  return res
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = user.email
  if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 })

  const code = generateCode()
  const codeHash = await hashCode(code)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

  try {
    // Invalidate prior unconsumed codes for this user.
    await supabase
      .from('login_otps')
      .update({ consumed: true })
      .eq('user_id', user.id)
      .eq('consumed', false)

    const { error } = await supabase.from('login_otps').insert({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt,
    })

    if (error) {
      // Table missing → don't hard-block login before migration is applied.
      if ((error as { code?: string }).code === '42P01') {
        return await unavailableResponse()
      }
      throw error
    }
  } catch {
    return await unavailableResponse()
  }

  try {
    await sendEmail({
      to: email,
      subject: 'Your Stratiq verification code',
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#0f172a;font-size:20px;margin:0 0 8px;">Verify your identity</h2>
          <p style="color:#475569;font-size:14px;margin:0 0 24px;">Enter this code to finish signing in to Stratiq. It expires in 10 minutes.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center;">${code}</div>
          <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">If you didn't try to sign in, you can safely ignore this email.</p>
        </div>
      `,
    })
  } catch {
    // Email delivery failed — fail open so the user isn't hard-blocked.
    return await unavailableResponse()
  }

  return NextResponse.json({ sent: true, email: maskEmail(email) })
}
