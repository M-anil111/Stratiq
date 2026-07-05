import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleToken } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type SettingsMap = Record<string, string>

function currentMonthPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const period_start = `${year}-${String(month).padStart(2, '0')}-01`
  const period_end = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { year, month, period_start, period_end }
}

async function syncMetaForClient(
  supabase: any,
  orgId: string,
  clientId: string,
  adAccountId: string,
  accessToken: string,
  period_start: string,
  period_end: string,
  year: number,
  month: number,
) {
  const url = new URL(`https://graph.facebook.com/v19.0/${adAccountId}/insights`)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('fields', 'impressions,clicks,reach,spend,actions,action_values,ctr')
  url.searchParams.set('level', 'account')
  url.searchParams.set('time_range', JSON.stringify({ since: period_start, until: period_end }))

  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)

  const row = json.data?.[0] || {}

  const conversions = (row.actions || [])
    .filter((a: any) => a.action_type === 'offsite_conversion')
    .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

  const revenue = (row.action_values || [])
    .filter((a: any) => a.action_type === 'offsite_conversion')
    .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0)

  const spend = parseFloat(row.spend || '0')
  const roas = spend > 0 ? revenue / spend : 0

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

  const { error } = await supabase
    .from('marketing_reports')
    .upsert({
      client_id: clientId,
      organization_id: orgId,
      year,
      month,
      meta_ads_data: metaData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,year,month' })

  if (error) throw new Error(error.message)
}

async function syncGoogleForClient(
  supabase: any,
  orgId: string,
  clientId: string,
  customerId: string,
  accessToken: string,
  period_start: string,
  period_end: string,
  year: number,
  month: number,
) {
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
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'login-customer-id': process.env.GOOGLE_ADS_MCC_ID || customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: gaqlQuery }),
    }
  )

  const adsData = await adsRes.json()
  if (!adsRes.ok) {
    throw new Error(adsData?.error?.message || `Google Ads API error ${adsRes.status}`)
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

  const { error } = await supabase
    .from('marketing_reports')
    .upsert({
      client_id: clientId,
      organization_id: orgId,
      year,
      month,
      google_ads_data: googleData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,year,month' })

  if (error) throw new Error(error.message)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { year, month, period_start, period_end } = currentMonthPeriod()

  // Fetch connection settings for all orgs
  const { data: settingRows, error: settingsError } = await supabase
    .from('organization_settings')
    .select('organization_id, key, value')
    .in('key', [
      'meta_connected', 'meta_access_token',
      'google_connected', 'google_access_token', 'google_refresh_token', 'google_token_expiry',
    ])

  if (settingsError) {
    // 42P01: table doesn't exist yet — return gracefully
    if ((settingsError as any).code === '42P01') {
      return NextResponse.json({ orgs: 0, synced: 0, errors: [] })
    }
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const orgSettings = new Map<string, SettingsMap>()
  for (const r of settingRows || []) {
    if (!orgSettings.has(r.organization_id)) orgSettings.set(r.organization_id, {})
    orgSettings.get(r.organization_id)![r.key] = r.value
  }

  let orgsProcessed = 0
  let synced = 0
  const errors: string[] = []

  for (const [orgId, settings] of Array.from(orgSettings)) {
    const metaConnected = settings.meta_connected === 'true' && !!settings.meta_access_token
    const googleConnected = settings.google_connected === 'true' && !!settings.google_access_token
    if (!metaConnected && !googleConnected) continue

    orgsProcessed++
    try {
      // Clients with linked ad accounts in this org
      const { data: integrations, error: intError } = await supabase
        .from('client_integrations')
        .select('client_id, platform, external_id')
        .eq('organization_id', orgId)
        .in('platform', ['meta_ads', 'google_ads'])

      if (intError) {
        if ((intError as any).code === '42P01') continue
        throw new Error(intError.message)
      }

      let googleToken: string | null = null
      if (googleConnected) {
        try {
          googleToken = await getGoogleToken(supabase, orgId)
        } catch (err: any) {
          errors.push(`org ${orgId} google token: ${err.message}`)
        }
      }

      for (const integration of integrations || []) {
        if (!integration.external_id || !integration.client_id) continue
        try {
          if (integration.platform === 'meta_ads' && metaConnected) {
            await syncMetaForClient(
              supabase, orgId, integration.client_id, integration.external_id,
              settings.meta_access_token, period_start, period_end, year, month,
            )
            synced++
          } else if (integration.platform === 'google_ads' && googleToken) {
            await syncGoogleForClient(
              supabase, orgId, integration.client_id, integration.external_id,
              googleToken, period_start, period_end, year, month,
            )
            synced++
          }
        } catch (err: any) {
          errors.push(`org ${orgId} client ${integration.client_id} (${integration.platform}): ${err.message}`)
        }
      }
    } catch (err: any) {
      errors.push(`org ${orgId}: ${err.message}`)
    }
  }

  return NextResponse.json({ orgs: orgsProcessed, synced, errors })
}
