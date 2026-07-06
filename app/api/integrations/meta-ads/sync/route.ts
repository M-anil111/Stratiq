import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const { client_id, ad_account_id, period_start, period_end } = body
  if (!client_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Get org-stored Meta token
  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', userData.organization_id)
    .in('key', ['meta_access_token', 'meta_connected'])
  const settings: Record<string, string> = {}
  for (const r of rows || []) settings[r.key] = r.value

  if (settings.meta_connected !== 'true' || !settings.meta_access_token) {
    return NextResponse.json({ error: 'Meta Ads not connected' }, { status: 400 })
  }

  const accountId = ad_account_id || null
  if (!accountId) return NextResponse.json({ error: 'No ad account linked to this client' }, { status: 400 })

  try {
    const url = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`)
    url.searchParams.set('access_token', settings.meta_access_token)
    url.searchParams.set('fields', 'impressions,clicks,reach,spend,actions,action_values,ctr')
    url.searchParams.set('level', 'account')
    url.searchParams.set('time_range', JSON.stringify({ since: period_start, until: period_end }))

    const res = await fetch(url.toString())
    const json = await res.json()

    if (json.error) return NextResponse.json({ error: json.error.message }, { status: 400 })

    const row = json.data?.[0] || {}

    const conversions = (row.actions || [])
      .filter((a: any) => a.action_type === 'offsite_conversion')
      .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

    const revenue = (row.action_values || [])
      .filter((a: any) => a.action_type === 'offsite_conversion')
      .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

    const spend = parseFloat(row.spend || '0')
    const roas = spend > 0 ? revenue / spend : 0

    // Parse year/month from period_start (YYYY-MM-DD)
    const [yearStr, monthStr] = period_start.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)

    const metaData = {
      impressions: parseInt(row.impressions || '0'),
      clicks: parseInt(row.clicks || '0'),
      reach: parseInt(row.reach || '0'),
      spend: Math.round(spend * 100) / 100,
      ctr: parseFloat(row.ctr || '0'),
      conversions: Math.round(conversions),
      roas: Math.round(roas * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      period_start,
      period_end,
      synced_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('marketing_reports')
      .upsert({
        client_id,
        organization_id: userData.organization_id,
        year,
        month,
        meta_ads_data: metaData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,year,month' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...data, meta: metaData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
