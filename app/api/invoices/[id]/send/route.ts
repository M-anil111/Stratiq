import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/index'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(company_name, contact_email)')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', userData.organization_id)
    .in('key', ['company_name', 'company_email'])

  const orgMap: Record<string, string> = {}
  for (const row of orgSettings || []) orgMap[row.key] = row.value

  const clientEmail = (invoice.client as any)?.contact_email
  if (!clientEmail) return NextResponse.json({ error: 'Client has no contact email' }, { status: 400 })

  const clientName = (invoice.client as any)?.company_name || 'Valued Client'
  const agencyName = orgMap.company_name || 'Your Agency'
  const lineItems: any[] = invoice.line_items || []

  const lineItemRows = lineItems.map(li => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">${li.description || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">${li.qty || 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">$${(parseFloat(li.unit_price) || 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">$${(parseFloat(li.amount) || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#111827;margin-bottom:4px;">Invoice from ${agencyName}</h2>
      <p style="color:#6b7280;margin-top:0;">Invoice #${invoice.invoice_number}</p>
      <p style="color:#374151;">Dear ${clientName},</p>
      <p style="color:#374151;">Please find your invoice details below.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:12px;">Description</th>
            <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;">Qty</th>
            <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItemRows}</tbody>
      </table>
      <div style="text-align:right;margin-top:8px;">
        <p style="color:#6b7280;margin:4px 0;">Subtotal: $${(invoice.subtotal || 0).toFixed(2)}</p>
        ${invoice.tax_amount ? `<p style="color:#6b7280;margin:4px 0;">Tax: $${(invoice.tax_amount || 0).toFixed(2)}</p>` : ''}
        <p style="color:#111827;font-weight:600;font-size:18px;margin:8px 0;">Total: $${(invoice.total || 0).toFixed(2)}</p>
      </div>
      ${invoice.due_date ? `<p style="color:#374151;"><strong>Due Date:</strong> ${invoice.due_date}</p>` : ''}
      ${invoice.notes ? `<p style="color:#374151;"><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:12px;">This invoice was sent by ${agencyName}. If you have questions, please reply to this email.</p>
    </div>
  `

  try {
    await sendEmail({
      to: clientEmail,
      subject: `Invoice #${invoice.invoice_number} from ${agencyName}`,
      html,
    })

    // Mark invoice as sent
    await supabase.from('invoices').update({
      status: 'sent',
      updated_at: new Date().toISOString(),
    }).eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Email send failed' }, { status: 500 })
  }
}
