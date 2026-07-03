import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // Verify caller is authorized (staff or cron)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { client_id, customer_id, period_start, period_end } = body
  if (!client_id || !customer_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Fetch access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      }),
    })
    const { access_token } = await tokenRes.json()

    // GAQL query for campaign stats
    const gaqlQuery = `
      SELECT
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.conversions,
        metrics.cost_micros
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
          'login-customer-id': process.env.GOOGLE_ADS_MCC_ID!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: gaqlQuery }),
      }
    )

    const adsData = await adsRes.json()

    // Aggregate metrics across all campaigns
    let impressions = 0, clicks = 0, conversions = 0, cost_micros = 0
    for (const batch of adsData) {
      for (const row of batch.results || []) {
        impressions += Number(row.metrics?.impressions || 0)
        clicks += Number(row.metrics?.clicks || 0)
        conversions += Number(row.metrics?.conversions || 0)
        cost_micros += Number(row.metrics?.costMicros || 0)
      }
    }

    const spend = cost_micros / 1_000_000
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

    // Upsert into marketing_reports
    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('marketing_reports')
      .upsert({
        client_id,
        organization_id: userData?.organization_id,
        period_start,
        period_end,
        report_type: 'google_ads',
        google_impressions: impressions,
        google_clicks: clicks,
        google_ctr: Math.round(ctr * 100) / 100,
        google_conversions: conversions,
        google_spend: Math.round(spend * 100) / 100,
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
