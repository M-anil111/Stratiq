import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
  from = 'Stratiq <noreply@stratiq.app>',
}: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  const { data, error } = await resend.emails.send({ from, to, subject, html })
  if (error) throw new Error(`Email send failed: ${error.message}`)
  return data
}
