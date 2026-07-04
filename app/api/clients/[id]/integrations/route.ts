import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .from('client_integrations')
    .select('platform, ad_account_id, ad_account_name, enabled')
    .eq('client_id', params.id)
    .eq('organization_id', userData?.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const body = await request.json()
  const { platform, ad_account_id, ad_account_name } = body

  if (!platform || !ad_account_id) {
    return NextResponse.json({ error: 'Missing platform or ad_account_id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_integrations')
    .upsert({
      client_id: params.id,
      organization_id: userData?.organization_id,
      platform,
      ad_account_id,
      ad_account_name: ad_account_name || null,
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,platform' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
