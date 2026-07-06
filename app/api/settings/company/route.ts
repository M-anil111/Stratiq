import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

const COMPANY_FIELDS = 'name, contact_email, billing_email, timezone, logo_url, website, address, city, state, postcode, country, phone'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const [orgResult, brandResult] = await Promise.all([
    supabase
      .from('organizations')
      .select(COMPANY_FIELDS)
      .eq('id', userData?.organization_id)
      .single(),
    supabase
      .from('organization_settings')
      .select('value')
      .eq('organization_id', userData?.organization_id)
      .eq('key', 'brand_color')
      .maybeSingle(),
  ])

  if (orgResult.error) {
    if (orgResult.error.code === '42P01') return NextResponse.json({})
    return NextResponse.json({ error: orgResult.error.message }, { status: 500 })
  }

  const brand_color = brandResult.error ? '' : (brandResult.data?.value ?? '')
  return NextResponse.json({ ...(orgResult.data || {}), brand_color })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, contact_email, billing_email, timezone, logo_url, website, address, city, state, postcode, country, phone, brand_color } = body

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name,
      contact_email,
      billing_email,
      timezone,
      logo_url,
      website,
      address,
      city,
      state,
      postcode,
      country,
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userData.organization_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // brand_color lives in the organization_settings key-value store
  if (brand_color !== undefined) {
    await supabase
      .from('organization_settings')
      .upsert(
        {
          organization_id: userData.organization_id,
          key: 'brand_color',
          value: typeof brand_color === 'string' ? brand_color : '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,key' }
      )
  }

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'settings_company_updated',
    entityType: 'organization',
    entityId: userData.organization_id,
  })

  return NextResponse.json(data)
}
