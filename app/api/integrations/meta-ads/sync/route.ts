import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { client_id, ad_account_id, period_start, period_end } = body
  if (!client_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const accountId = ad_account_id || process.env.META_ADS_AD_ACCOUNT_ID
  const token = process.env.META_ADS_ACCESS_TOKEN

  try {
    const url = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`)
    url.searchParams.set('access_token', token!)
    url.searchParams.set('fields', 'impressions,clicks,spend,actions,action_values')
    url.searchParams.set('level', 'account')
    url.searchParams.set('time_range', JSON.stringify({ since: period_start, until: period_end }))

    const res = await fetch(url.toString())
    const json = await res.json()
    const row = json.data?.[0] || {}

    const conversions = (row.actions || [])
      .filter((a: any) => a.action_type === 'offsite_conversion')
      .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

    const revenue = (row.action_values || [])
      .filter((a: any) => a.action_type === 'offsite_conversion')
      .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

    const spend = parseFloat(row.spend || '0')
    const roas = spend > 0 ? revenue / spend : 0

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('marketing_reports')
      .upsert({
        client_id,
        organization_id: userData?.organization_id,
        period_start,
        period_end,
        report_type: 'meta_ads',
        meta_impressions: parseInt(row.impressions || '0'),
        meta_clicks: parseInt(row.clicks || '0'),
        meta_spend: Math.round(spend * 100) / 100,
        meta_conversions: conversions,
        meta_roas: Math.round(roas * 100) / 100,
        status: 'published',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,period_start,period_end,report_type' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
