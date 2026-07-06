import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  return _resend
}

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.EMAIL_FROM || 'Stratiq <noreply@stratiqnow.com>',
}: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  const { data, error } = await getResend().emails.send({ from, to, subject, html })
  if (error) throw new Error(`Email send failed: ${error.message}`)
  return data
}
