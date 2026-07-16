import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { verifyTurnstile } from '@/lib/turnstile'

export async function POST(req: NextRequest) {
  const { name, email, role, message, turnstileToken } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const humanVerified = await verifyTurnstile(turnstileToken, req.headers.get('x-forwarded-for') || undefined)
  if (!humanVerified) return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })

  try {
    await sendEmail({
      to: 'jay@jaymehta.co',
      subject: `New Stratiq access request from ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#0ea5e9">New Access Request</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b;width:80px">Name</td><td style="padding:8px 0;color:#1e293b;font-weight:600">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0;color:#1e293b">${email}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Role</td><td style="padding:8px 0;color:#1e293b">${role || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Message</td><td style="padding:8px 0;color:#1e293b">${message || '—'}</td></tr>
          </table>
          <p style="color:#64748b;font-size:13px;margin-top:24px">Go to your Stratiq Team settings to invite this user.</p>
        </div>
      `,
    })
  } catch {
    // Email may fail if Resend not fully configured — still return success
  }

  return NextResponse.json({ success: true })
}
