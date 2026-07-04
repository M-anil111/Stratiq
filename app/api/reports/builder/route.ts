import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const clientsParam = searchParams.get('clients') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const clientIds = clientsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (clientIds.length === 0 || !from || !to) {
    return NextResponse.json({ error: 'Missing required params: clients, from, to' }, { status: 400 })
  }

  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)

  const { data: rows, error } = await supabase
    .from('marketing_reports')
    .select('client_id, year, month, google_ads_data, meta_ads_data')
    .eq('organization_id', userData.organization_id)
    .in('client_id', clientIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inRange = (year: number, month: number) => {
    const val = year * 100 + month
    return val >= fromYear * 100 + fromMonth && val <= toYear * 100 + toMonth
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', userData.organization_id)
    .in('id', clientIds)

  const clientMap: Record<string, string> = {}
  for (const c of clients || []) clientMap[c.id] = c.company_name

  interface Agg {
    impressions: number; clicks: number; conversions: number; spend: number
    roas_sum: number; roas_count: number; ctr_sum: number; ctr_count: number
  }
  const blank = (): Agg => ({ impressions: 0, clicks: 0, conversions: 0, spend: 0, roas_sum: 0, roas_count: 0, ctr_sum: 0, ctr_count: 0 })
  const agg: Record<string, { google: Agg; meta: Agg }> = {}

  for (const row of rows || []) {
    if (!inRange(row.year, row.month)) continue
    if (!agg[row.client_id]) agg[row.client_id] = { google: blank(), meta: blank() }
    const addTo = (ch: Agg, data: any) => {
      if (!data) return
      ch.impressions += Number(data.impressions || 0)
      ch.clicks += Number(data.clicks || 0)
      ch.conversions += Number(data.conversions || 0)
      ch.spend += Number(data.spend || 0)
      if (data.roas != null) { ch.roas_sum += Number(data.roas); ch.roas_count++ }
      if (data.ctr != null) { ch.ctr_sum += Number(data.ctr); ch.ctr_count++ }
    }
    addTo(agg[row.client_id].google, row.google_ads_data)
    addTo(agg[row.client_id].meta, row.meta_ads_data)
  }

  const finalAgg = (ch: Agg) => {
    const hasData = ch.impressions > 0 || ch.clicks > 0 || ch.spend > 0
    if (!hasData) return null
    return {
      impressions: ch.impressions,
      clicks: ch.clicks,
      conversions: ch.conversions,
      spend: ch.spend,
      roas: ch.roas_count > 0 ? parseFloat((ch.roas_sum / ch.roas_count).toFixed(2)) : null,
      ctr: ch.ctr_count > 0 ? parseFloat((ch.ctr_sum / ch.ctr_count).toFixed(2)) : null,
    }
  }

  const result = clientIds.map(id => ({
    client_id: id,
    client_name: clientMap[id] || id,
    google_ads: agg[id] ? finalAgg(agg[id].google) : null,
    meta_ads: agg[id] ? finalAgg(agg[id].meta) : null,
  }))

  return NextResponse.json(result)
}
