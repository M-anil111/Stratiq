import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOrgClient(supabase: any, userId: string) {
  const { data } = await supabase.from('users').select('organization_id, role').eq('id', userId).single()
  return data
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const clientsParam = searchParams.get('clients') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const metricsParam = searchParams.get('metrics') || ''

  const clientIds = clientsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (clientIds.length === 0 || !from || !to) {
    return NextResponse.json({ error: 'Missing required params: clients, from, to' }, { status: 400 })
  }

  // Fetch marketing reports with org scoping
  const { data: rows, error } = await supabase
    .from('marketing_reports')
    .select('client_id, channel, impressions, clicks, conversions, spend, roas, ctr, month')
    .eq('organization_id', userData.organization_id)
    .in('client_id', clientIds)
    .gte('month', from)
    .lte('month', to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch client names (org scoped)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', userData.organization_id)
    .in('id', clientIds)

  const clientMap: Record<string, string> = {}
  for (const c of clients || []) clientMap[c.id] = c.company_name

  // Aggregate by client_id + channel
  type ChannelAgg = {
    impressions: number; clicks: number; conversions: number; spend: number
    roas_sum: number; roas_count: number; ctr_sum: number; ctr_count: number
  }
  const agg: Record<string, { google_ads: ChannelAgg; meta_ads: ChannelAgg }> = {}

  const blankChannel = (): ChannelAgg => ({ impressions: 0, clicks: 0, conversions: 0, spend: 0, roas_sum: 0, roas_count: 0, ctr_sum: 0, ctr_count: 0 })

  for (const row of rows || []) {
    if (!agg[row.client_id]) agg[row.client_id] = { google_ads: blankChannel(), meta_ads: blankChannel() }
    const ch: ChannelAgg = row.channel === 'google_ads' ? agg[row.client_id].google_ads : agg[row.client_id].meta_ads
    ch.impressions += Number(row.impressions || 0)
    ch.clicks += Number(row.clicks || 0)
    ch.conversions += Number(row.conversions || 0)
    ch.spend += Number(row.spend || 0)
    if (row.roas != null) { ch.roas_sum += Number(row.roas); ch.roas_count++ }
    if (row.ctr != null) { ch.ctr_sum += Number(row.ctr); ch.ctr_count++ }
  }

  const finalChannel = (ch: ChannelAgg) => ({
    impressions: ch.impressions,
    clicks: ch.clicks,
    conversions: ch.conversions,
    spend: ch.spend,
    roas: ch.roas_count > 0 ? ch.roas_sum / ch.roas_count : null,
    ctr: ch.ctr_count > 0 ? ch.ctr_sum / ch.ctr_count : null,
  })

  const result = clientIds.map(id => ({
    client_id: id,
    client_name: clientMap[id] || id,
    google_ads: agg[id] ? finalChannel(agg[id].google_ads) : null,
    meta_ads: agg[id] ? finalChannel(agg[id].meta_ads) : null,
  }))

  return NextResponse.json(result)
}
