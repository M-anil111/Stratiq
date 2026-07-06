import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOrgContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, organizationId: null }

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  return { supabase, user, organizationId: userData?.organization_id || null }
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, organizationId } = await getOrgContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', organizationId)
    .single()

  if (leadError) {
    if (leadError.code === '42P01') return NextResponse.json({ __unavailable: true }, { status: 503 })
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  if (lead.converted_client_id) {
    return NextResponse.json({ client_id: lead.converted_client_id, already_converted: true })
  }

  // Only columns that exist on clients (migrations 001/008); website is NOT NULL
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      organization_id: organizationId,
      company_name: lead.company_name,
      website: lead.website || '',
      email: lead.email || null,
      phone: lead.phone || null,
      project_status: 'in_onboarding',
    })
    .select('id')
    .single()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update({ stage: 'won', converted_client_id: client.id, updated_at: new Date().toISOString() })
    .eq('id', lead.id)
    .eq('organization_id', organizationId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ client_id: client.id })
}
