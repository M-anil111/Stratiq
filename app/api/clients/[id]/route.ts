import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOrgClient(supabase: any, userId: string) {
  const { data } = await supabase.from('users').select('organization_id, role').eq('id', userId).single()
  return data
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data, error } = await supabase
    .from('clients')
    .select('*, sales_manager:users!sales_manager_id(id,full_name,email), dm_manager:users!dm_manager_id(id,full_name,email), marketing_manager:users!marketing_manager_id(id,full_name,email), projects(id,domain,status,services,start_date,created_at)')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin', 'manager'].includes(userData.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const { data, error } = await supabase
    .from('clients')
    .update({
      sales_manager_id: body.sales_manager_id ?? undefined,
      dm_manager_id: body.dm_manager_id ?? undefined,
      marketing_manager_id: body.marketing_manager_id ?? undefined,
      company_name: body.company_name,
      website: body.website,
      about_company: body.about_company,
      industry: body.industry,
      email: body.email,
      phone: body.phone,
      street_address: body.street_address,
      city: body.city,
      state: body.state,
      country: body.country,
      hashtags: body.hashtags,
      categories: body.categories,
      num_employees: body.num_employees ? parseInt(body.num_employees) : null,
      project_status: body.project_status,
      services: body.services,
      service_packages: body.service_packages,
      advertising_types: body.advertising_types,
      goals: body.goals,
      stakeholder_expectations: body.stakeholder_expectations,
      target_audience: body.target_audience,
      website_last_updated: body.website_last_updated || null,
      ndisk_link: body.ndisk_link,
      google_drive_folder_url: body.google_drive_folder_url,
      proposal_url: body.proposal_url || null,
      client_degree: body.client_degree,
      client_pin: body.client_pin,
      maint_since: body.maint_since,
      maint_degree: body.maint_degree,
      credit_status: body.credit_status,
    })
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin'].includes(userData.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
