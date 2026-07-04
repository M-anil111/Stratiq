import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientFolder } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = (page - 1) * limit

  let query = supabase
    .from('clients')
    .select('*, sales_manager:users!sales_manager_id(full_name, email), dm_manager:users!dm_manager_id(full_name, email)', { count: 'exact' })
    .eq('organization_id', userData.organization_id)
    .order('company_name')
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,website.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('project_status', status)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: data, total: count, page, limit })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin', 'manager', 'team_member'].includes(userData.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      organization_id: userData.organization_id,
      company_name: body.company_name,
      website: body.website,
      about_company: body.about_company,
      industry: body.industry,
      email: body.email,
      phone: body.phone,
      street_address: body.street_address,
      city: body.city,
      state: body.state,
      country: body.country || 'US',
      hashtags: body.hashtags || [],
      categories: body.categories || [],
      num_employees: body.num_employees ? parseInt(body.num_employees) : null,
      project_status: body.project_status || 'active',
      services: body.services || [],
      advertising_types: body.advertising_types || [],
      goals: body.goals || [],
      stakeholder_expectations: body.stakeholder_expectations || [],
      target_audience: body.target_audience,
      website_last_updated: body.website_last_updated || null,
      ndisk_link: body.ndisk_link,
      google_drive_folder_url: body.google_drive_folder_url,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create Google Drive folder for new client (non-fatal)
  try {
    const folderId = await createClientFolder(supabase, body.company_name)
    await supabase.from('clients').update({ google_drive_folder_id: folderId }).eq('id', data.id)
    data.google_drive_folder_id = folderId
  } catch { /* Drive not connected or env var missing — skip */ }

  return NextResponse.json(data, { status: 201 })
}
