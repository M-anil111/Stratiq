import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FALLBACK = { company_name: 'Stratiq', logo_url: null, brand_color: null }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json(FALLBACK)

  // Portal users can't read org tables via RLS — use admin client after auth
  const admin = createAdminClient()

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('organization_id')
    .eq('id', portalAccess.client_id)
    .single()

  if (clientError || !client?.organization_id) return NextResponse.json(FALLBACK)

  const [orgResult, settingsResult] = await Promise.all([
    admin
      .from('organizations')
      .select('name, logo_url')
      .eq('id', client.organization_id)
      .single(),
    admin
      .from('organization_settings')
      .select('value')
      .eq('organization_id', client.organization_id)
      .eq('key', 'brand_color')
      .maybeSingle(),
  ])

  if (orgResult.error && orgResult.error.code !== '42P01') {
    // Missing row or table — degrade to fallbacks rather than erroring the portal
    return NextResponse.json(FALLBACK)
  }

  const brandColor =
    settingsResult.error?.code === '42P01' ? null : (settingsResult.data?.value ?? null)

  return NextResponse.json({
    company_name: orgResult.data?.name || 'Stratiq',
    logo_url: orgResult.data?.logo_url || null,
    brand_color: brandColor || null,
  })
}
