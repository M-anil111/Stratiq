import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyOrgManagers } from '@/lib/notify'
import { sendEmail } from '@/lib/email/index'

// Public endpoint: approve or reject a proposal via a one-time token from the email
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const action = request.nextUrl.searchParams.get('action')

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action. Use ?action=approve or ?action=reject' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, company_name, proposal_status, organization_id')
    .eq('approval_token', token)
    .single()

  if (error || !client) {
    // 42P01 = table missing, PGRST116 = no rows (invalid or already-used token)
    return NextResponse.json({ error: 'Invalid or already used approval link' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const update =
    action === 'approve'
      ? { proposal_status: 'approved', approved_at: now, approval_token: null }
      : { proposal_status: 'rejected', rejected_at: now, approval_token: null }

  const { error: updateError } = await supabase.from('clients').update(update).eq('id', client.id)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Best-effort notify managers of the approval/rejection.
  if (client.organization_id) {
    try {
      await notifyOrgManagers(supabase, client.organization_id, {
        type: 'info',
        severity: action === 'approve' ? 'success' : 'warning',
        title: action === 'approve' ? 'Proposal approved' : 'Proposal rejected',
        body: `Proposal for ${client.company_name} was ${action === 'approve' ? 'approved' : 'rejected'}`,
        link: `/clients/${client.id}`,
        entityType: 'client',
        entityId: client.id,
      })
    } catch {
      // non-fatal
    }

    // Best-effort external notification email to configured recipients.
    try {
      const { data: notifRow } = await supabase
        .from('organization_settings')
        .select('value')
        .eq('organization_id', client.organization_id)
        .eq('key', 'notification_emails')
        .single()
      const recipientList = notifRow?.value
        ? notifRow.value.split(',').map((e: string) => e.trim()).filter(Boolean)
        : (process.env.APPROVAL_EMAIL || 'jay@jaymehta.co').split(',').map((e: string) => e.trim())

      for (const recipient of recipientList) {
        await sendEmail({
          to: recipient,
          subject: `Proposal for ${client.company_name} was ${action === 'approve' ? 'approved' : 'rejected'}`,
          html: `<p>Proposal for ${client.company_name} was ${action === 'approve' ? 'approved' : 'rejected'}.</p>`,
        })
      }
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({
    success: true,
    action,
    company_name: client.company_name,
    message: action === 'approve' ? 'Proposal approved' : 'Proposal rejected',
  })
}
