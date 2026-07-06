import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Metrics {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
}

interface DerivedMetrics extends Metrics {
  ctr: number
  cpc: number
  cost_per_conversion: number
  roas: number
}

function emptyMetrics(): Metrics {
  return { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 }
}

function addMetrics(target: Metrics, src: Metrics) {
  target.impressions += src.impressions
  target.clicks += src.clicks
  target.spend += src.spend
  target.conversions += src.conversions
  target.revenue += src.revenue
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function derive(m: Metrics): DerivedMetrics {
  return {
    impressions: m.impressions,
    clicks: m.clicks,
    spend: round2(m.spend),
    conversions: m.conversions,
    revenue: round2(m.revenue),
    ctr: m.impressions > 0 ? round2((m.clicks / m.impressions) * 100) : 0,
    cpc: m.clicks > 0 ? round2(m.spend / m.clicks) : 0,
    cost_per_conversion: m.conversions > 0 ? round2(m.spend / m.conversions) : 0,
    roas: m.spend > 0 ? round2(m.revenue / m.spend) : 0,
  }
}

/**
 * Extract normalized metrics from a network's JSONB blob (meta_ads_data / google_ads_data).
 * When ROI mode is "estimate", revenue is computed with an adaptation of HubSpot's
 * ROI estimate formula. HubSpot's original:
 *   (contacts − customers) × conversion_rate × avg_sale_price + customers × avg_sale_price
 * Stratiq's ads sync only stores aggregate conversions (no contact/customer split), so
 * we adapt it to:
 *   estimated_revenue = conversions × conversion_rate × avg_sale_price
 * i.e. every conversion is treated as a contact expected to become a customer at
 * `conversion_rate`, each worth `avg_sale_price`.
 */
function extractMetrics(
  blob: any,
  roi: { mode: string; avgSalePrice: number; conversionRate: number },
): Metrics | null {
  if (!blob || typeof blob !== 'object') return null
  const conversions = Number(blob.conversions || 0)
  let revenue = Number(blob.revenue || 0)
  if (roi.mode === 'estimate') {
    revenue = conversions * roi.conversionRate * roi.avgSalePrice
  }
  return {
    impressions: Number(blob.impressions || 0),
    clicks: Number(blob.clicks || 0),
    spend: Number(blob.spend || 0),
    conversions,
    revenue,
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  const orgId = userData.organization_id

  const { searchParams } = new URL(request.url)
  const monthsParam = parseInt(searchParams.get('months') || '6', 10)
  const months = [3, 6, 12].includes(monthsParam) ? monthsParam : 6
  const network = searchParams.get('network') || 'all' // all | meta | google
  const clientIdFilter = searchParams.get('client_id') || null

  // Build the month range (inclusive of the current month)
  const now = new Date()
  const monthKeys: { year: number; month: number; key: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  const earliest = monthKeys[0]
  const minIndex = earliest.year * 12 + earliest.month

  // ROI settings (missing table or keys => defaults)
  const roi = { mode: 'revenue', avgSalePrice: 0, conversionRate: 0 }
  const { data: settingRows, error: settingsError } = await supabase
    .from('organization_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['ads_roi_mode', 'ads_avg_sale_price', 'ads_conversion_rate'])

  if (!settingsError) {
    for (const row of settingRows || []) {
      if (row.key === 'ads_roi_mode' && (row.value === 'revenue' || row.value === 'estimate')) roi.mode = row.value
      if (row.key === 'ads_avg_sale_price') roi.avgSalePrice = Number(row.value) || 0
      if (row.key === 'ads_conversion_rate') roi.conversionRate = Number(row.value) || 0
    }
  } else if ((settingsError as any).code !== '42P01') {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  // Org clients (for names + org scoping of report rows)
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', orgId)

  if (clientsError && (clientsError as any).code !== '42P01') {
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }
  const clientNames = new Map<string, string>()
  for (const c of clients || []) clientNames.set(c.id, c.company_name)

  // Marketing reports across the range (filter precisely in JS — the range can span years)
  let query = supabase
    .from('marketing_reports')
    .select('client_id, year, month, meta_ads_data, google_ads_data')
    .eq('organization_id', orgId)
    .gte('year', earliest.year)
  if (clientIdFilter) query = query.eq('client_id', clientIdFilter)

  const { data: reportRows, error: reportsError } = await query
  if (reportsError && (reportsError as any).code !== '42P01') {
    return NextResponse.json({ error: reportsError.message }, { status: 500 })
  }

  const includeMeta = network === 'all' || network === 'meta'
  const includeGoogle = network === 'all' || network === 'google'

  const summaryTotals = emptyMetrics()
  const networkTotals: Record<string, Metrics> = { meta: emptyMetrics(), google: emptyMetrics() }
  const clientTotals = new Map<string, Metrics>() // key: `${client_id}|${network}`
  const monthTotals = new Map<string, Metrics>()
  for (const mk of monthKeys) monthTotals.set(mk.key, emptyMetrics())

  for (const row of reportRows || []) {
    const idx = row.year * 12 + row.month
    if (idx < minIndex) continue
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`
    if (!monthTotals.has(key)) continue // future/out-of-range safety
    // Only include rows for clients that belong to this org
    if (!clientNames.has(row.client_id)) continue

    const perNetwork: [string, Metrics | null][] = []
    if (includeMeta) perNetwork.push(['meta', extractMetrics(row.meta_ads_data, roi)])
    if (includeGoogle) perNetwork.push(['google', extractMetrics(row.google_ads_data, roi)])

    for (const [net, metrics] of perNetwork) {
      if (!metrics) continue
      addMetrics(summaryTotals, metrics)
      addMetrics(networkTotals[net], metrics)
      addMetrics(monthTotals.get(key)!, metrics)
      const clientKey = `${row.client_id}|${net}`
      if (!clientTotals.has(clientKey)) clientTotals.set(clientKey, emptyMetrics())
      addMetrics(clientTotals.get(clientKey)!, metrics)
    }
  }

  const by_client = Array.from(clientTotals.entries()).map(([clientKey, metrics]) => {
    const [client_id, net] = clientKey.split('|')
    return {
      client_id,
      company_name: clientNames.get(client_id) || 'Unknown client',
      network: net,
      ...derive(metrics),
    }
  }).sort((a, b) => b.spend - a.spend)

  const by_month = monthKeys.map(mk => {
    const m = monthTotals.get(mk.key)!
    return {
      month: mk.key,
      spend: round2(m.spend),
      clicks: m.clicks,
      impressions: m.impressions,
      revenue: round2(m.revenue),
      conversions: m.conversions,
    }
  })

  return NextResponse.json({
    summary: derive(summaryTotals),
    by_network: {
      ...(includeMeta ? { meta: derive(networkTotals.meta) } : {}),
      ...(includeGoogle ? { google: derive(networkTotals.google) } : {}),
    },
    by_client,
    by_month,
    roi_mode: roi.mode,
  })
}
