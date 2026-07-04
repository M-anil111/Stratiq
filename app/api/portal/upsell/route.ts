import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUpsellRecommendations } from '@/lib/upsell-engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const { data: projects } = await supabase
    .from('projects')
    .select('services')
    .eq('client_id', portalAccess.client_id)

  const allServices = (projects || []).flatMap(p => p.services || [])
  const unique = [...new Set(allServices)]
  const recommendations = getUpsellRecommendations(unique)
  return NextResponse.json(recommendations)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(organization_id)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json({ error: 'No access' }, { status: 403 })

  const { interested_in } = await request.json()

  // Log upsell interest in upsell_analytics table
  await supabase.from('upsell_analytics').insert({
    client_id: portalAccess.client_id,
    organization_id: (portalAccess.clients as any)?.organization_id,
    services_requested: interested_in,
    status: 'pending',
  })

  return NextResponse.json({ ok: true })
}
