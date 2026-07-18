import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { can } from '@/lib/permissions'

async function getOrgClient(supabase: any, userId: string) {
  // Select `permissions` too (migration 038) so we can apply granular gates.
  // Tolerant of the column not existing yet on the live DB.
  const res = await supabase.from('users').select('organization_id, role, permissions').eq('id', userId).single()
  if (res.error && (res.error.code === '42703' || /permissions/.test(res.error.message || ''))) {
    const fb = await supabase.from('users').select('organization_id, role').eq('id', userId).single()
    return fb.data
  }
  return res.data
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // The manager joins (migration 007) and projects.start_date (migration 028)
  // may not exist on the live DB. Fall back to progressively simpler selects so
  // a client that genuinely exists is never reported as "not found".
  const selects = [
    '*, sales_manager:users!sales_manager_id(id,full_name,email), dm_manager:users!dm_manager_id(id,full_name,email), marketing_manager:users!marketing_manager_id(id,full_name,email), projects(id,domain,status,services,start_date,created_at)',
    '*, sales_manager:users!sales_manager_id(id,full_name,email), dm_manager:users!dm_manager_id(id,full_name,email), projects(id,domain,status,services,created_at)',
    '*, projects(id,domain,status,services,created_at)',
    '*',
  ]

  let data: any = null
  let error: any = null
  for (const sel of selects) {
    const res = await supabase
      .from('clients')
      .select(sel)
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single()
    data = res.data
    error = res.error
    if (!error && data) break
    // Only retry with a simpler select when it's a schema/relationship problem;
    // a genuine no-row (PGRST116) should fall through to the 404.
    if (error && !/Could not find|does not exist|schema cache|relationship/i.test(error.message || '')) break
  }

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
      google_place_id: body.google_place_id ?? undefined,
      proposal_status: body.proposal_status ?? undefined,
    })
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'client_updated',
    entityType: 'client',
    entityId: params.id,
    detail: { company_name: body.company_name },
  })

  return NextResponse.json(data)
}

// Lightweight partial-update endpoint used by the client detail page to save
// just the custom_field_values jsonb column without touching (or clobbering,
// via undefined-coerced-to-null footguns in PUT above) any other field.
// Tolerant of the custom_field_values column not existing yet (42703 / not
// found in schema cache), matching the pattern used elsewhere in this API.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  if (!('custom_field_values' in body)) {
    return NextResponse.json({ error: 'custom_field_values is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ custom_field_values: body.custom_field_values })
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .select()
    .single()

  if (error) {
    if (error.code === '42703' || /custom_field_values/.test(error.message || '')) {
      return NextResponse.json({ error: 'Custom fields are not set up on this database yet' }, { status: 501 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'client_updated',
    entityType: 'client',
    entityId: params.id,
    detail: { custom_field_values: true },
  })

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
  // Granular per-user permission gate (enforced core) on top of the role check.
  if (!can(userData, 'clients', 'delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'client_deleted',
    entityType: 'client',
    entityId: params.id,
  })

  return NextResponse.json({ success: true })
}
