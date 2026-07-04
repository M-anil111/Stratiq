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
    .select('*, sales_manager:users!sales_manager_id(id,full_name,email), dm_manager:users!dm_manager_id(id,full_name,email), projects(id,domain,status,services)')
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

  const body = await request.json()
  const {
    company_name, website, about_company, industry, email, phone,
    street_address, city, state, country, num_employees, project_status,
    services, advertising_types, goals, stakeholder_expectations,
    target_audience, website_last_updated, ndisk_link, google_drive_folder_url,
    sales_manager_id, dm_manager_id,
  } = body
  const { data, error } = await supabase
    .from('clients')
    .update({
      company_name, website, about_company, industry, email, phone,
      street_address, city, state, country,
      num_employees: num_employees ? parseInt(num_employees, 10) : null,
      project_status, services, advertising_types, goals,
      stakeholder_expectations, target_audience, website_last_updated,
      ndisk_link, google_drive_folder_url, sales_manager_id, dm_manager_id,
      updated_at: new Date().toISOString(),
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
  if (!['super_admin', 'admin'].includes(userData?.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Verify belongs to org
  const { data: client } = await supabase.from('clients').select('id').eq('id', params.id).eq('organization_id', userData.organization_id).single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('clients').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
