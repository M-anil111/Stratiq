import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken } from '@/lib/google-oauth'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const { client_id, customer_id, period_start, period_end } = body
  if (!client_id || !customer_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const access_token = await getGoogleToken(supabase, userData.organization_id)
  if (!access_token) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
  }

  try {
    const gaqlQuery = `
      SELECT
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.conversions,
        metrics.cost_micros,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${period_start}' AND '${period_end}'
        AND campaign.status = 'ENABLED'
    `

    const adsRes = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customer_id}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          'login-customer-id': process.env.GOOGLE_ADS_MCC_ID || customer_id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: gaqlQuery }),
      }
    )

    const adsData = await adsRes.json()
    if (!adsRes.ok) {
      return NextResponse.json({ error: adsData?.error?.message || `Google Ads API error ${adsRes.status}` }, { status: 502 })
    }

    let impressions = 0, clicks = 0, conversions = 0, cost_micros = 0, conversions_value = 0
    const campaigns: any[] = []

    for (const batch of Array.isArray(adsData) ? adsData : [adsData]) {
      for (const row of batch.results || []) {
        const imp = Number(row.metrics?.impressions || 0)
        const clk = Number(row.metrics?.clicks || 0)
        const conv = Number(row.metrics?.conversions || 0)
        const cost = Number(row.metrics?.costMicros || 0)
        const convVal = Number(row.metrics?.conversionsValue || 0)
        impressions += imp
        clicks += clk
        conversions += conv
        cost_micros += cost
        conversions_value += convVal
        campaigns.push({
          name: row.campaign?.name,
          impressions: imp,
          clicks: clk,
          conversions: conv,
          spend: Math.round(cost / 10000) / 100,
          ctr: imp > 0 ? Math.round((clk / imp) * 10000) / 100 : 0,
        })
      }
    }

    const spend = Math.round(cost_micros / 10000) / 100
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0
    const roas = spend > 0 ? Math.round((conversions_value / spend) * 100) / 100 : 0

    const [yearStr, monthStr] = period_start.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)

    const googleData = {
      impressions,
      clicks,
      ctr,
      conversions: Math.round(conversions),
      spend,
      roas,
      revenue: Math.round(conversions_value * 100) / 100,
      campaigns,
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
        google_ads_data: googleData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,year,month' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...data, google: googleData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
