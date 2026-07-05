import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    .select('id, company_name, proposal_status')
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

  return NextResponse.json({
    success: true,
    action,
    company_name: client.company_name,
    message: action === 'approve' ? 'Proposal approved' : 'Proposal rejected',
  })
}
