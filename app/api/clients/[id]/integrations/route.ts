import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('client_integrations').select('*').eq('client_id', params.id)

  // Normalize: surface config.name as ad_account_name for client compatibility
  const normalized = (data || []).map((row: any) => ({
    ...row,
    ad_account_id: row.external_id,
    ad_account_name: row.config?.name || row.external_id,
  }))

  return NextResponse.json(normalized)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const body = await req.json()

  // Map ad_account_id → external_id, ad_account_name → config.name
  const external_id = body.ad_account_id || body.external_id || null
  const configName = body.ad_account_name || body.account_id || null
  const config = configName ? { name: configName } : (body.config || null)

  const { data, error } = await supabase.from('client_integrations')
    .upsert({
      client_id: params.id,
      organization_id: userData?.organization_id,
      platform: body.platform,
      external_id,
      config,
    }, { onConflict: 'client_id,platform' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ...data,
    ad_account_id: data.external_id,
    ad_account_name: data.config?.name || data.external_id,
  })
}
