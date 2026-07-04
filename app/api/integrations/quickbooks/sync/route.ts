import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Get the mapped QB customer integration for this client
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'quickbooks')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'No QuickBooks customer mapped for this client' }, { status: 404 })
  }

  // Placeholder — full sync logic would fetch customer from QB and update client record
  return NextResponse.json({ success: true, customerId: integration.external_id })
}
