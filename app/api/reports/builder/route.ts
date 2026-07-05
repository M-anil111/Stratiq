import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TEMPLATES_KEY = 'report_templates'

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, supabase, user: null, orgId: null }
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return { error: 'No organization', status: 403 as const, supabase, user, orgId: null }
  return { error: null, status: 200 as const, supabase, user, orgId: userData.organization_id as string }
}

// GET /api/reports/builder
// - ?templates=1  → list saved templates from org settings
// - ?clients=...  → legacy report generation (kept for backward compat)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const auth = await getAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, orgId } = auth

  // Templates mode
  if (searchParams.get('templates') === '1') {
    const { data } = await supabase
      .from('organization_settings')
      .select('value')
      .eq('organization_id', orgId)
      .eq('key', TEMPLATES_KEY)
      .single()
    let templates: unknown[] = []
    try { templates = JSON.parse(data?.value || '[]') } catch {}
    return NextResponse.json({ templates })
  }

  // Legacy report generation
  const clientsParam = searchParams.get('clients') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const clientIds = clientsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (clientIds.length === 0 || !from || !to) {
    return NextResponse.json({ error: 'Missing required params: clients, from, to (or use ?templates=1)' }, { status: 400 })
  }

  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)

  const { data: rows, error } = await supabase
    .from('marketing_reports')
    .select('client_id, year, month, google_ads_data, meta_ads_data')
    .eq('organization_id', orgId)
    .in('client_id', clientIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inRange = (year: number, month: number) => {
    const val = year * 100 + month
    return val >= fromYear * 100 + fromMonth && val <= toYear * 100 + toMonth
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('organization_id', orgId)
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
    const addTo = (ch: Agg, data: Record<string, unknown> | null) => {
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

// POST /api/reports/builder — save a template { name, sections }
export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, orgId } = auth

  const body = await request.json()
  const { name, sections, customText } = body as { name?: string; sections?: string[]; customText?: string }
  if (!name || !Array.isArray(sections)) {
    return NextResponse.json({ error: 'name and sections are required' }, { status: 400 })
  }

  // Load existing
  const { data: existing } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', TEMPLATES_KEY)
    .single()

  let templates: { name: string; sections: string[]; customText?: string }[] = []
  try { templates = JSON.parse(existing?.value || '[]') } catch {}

  // Upsert by name
  templates = templates.filter(t => t.name !== name)
  templates.unshift({ name, sections, ...(customText ? { customText } : {}) })

  const { error } = await supabase
    .from('organization_settings')
    .upsert(
      { organization_id: orgId, key: TEMPLATES_KEY, value: JSON.stringify(templates) },
      { onConflict: 'organization_id,key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, templates })
}

// DELETE /api/reports/builder — remove template by name
export async function DELETE(request: NextRequest) {
  const auth = await getAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name query param required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', TEMPLATES_KEY)
    .single()

  let templates: { name: string }[] = []
  try { templates = JSON.parse(existing?.value || '[]') } catch {}
  templates = templates.filter(t => t.name !== name)

  const { error } = await supabase
    .from('organization_settings')
    .upsert(
      { organization_id: orgId, key: TEMPLATES_KEY, value: JSON.stringify(templates) },
      { onConflict: 'organization_id,key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, templates })
}
