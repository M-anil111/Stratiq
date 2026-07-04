import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function flattenReport(row: any) {
  if (!row) return null
  const meta = row.meta_ads_data || {}
  const google = row.google_ads_data || {}
  return {
    ...row,
    // Flatten meta
    meta_impressions: meta.impressions ?? null,
    meta_clicks: meta.clicks ?? null,
    meta_spend: meta.spend ?? null,
    meta_roas: meta.roas ?? null,
    meta_reach: meta.reach ?? null,
    meta_ctr: meta.ctr ?? null,
    meta_conversions: meta.conversions ?? null,
    meta_revenue: meta.revenue ?? null,
    meta_period_start: meta.period_start ?? null,
    meta_period_end: meta.period_end ?? null,
    // Flatten google
    google_impressions: google.impressions ?? null,
    google_clicks: google.clicks ?? null,
    google_spend: google.spend ?? null,
    google_roas: google.roas ?? null,
    google_ctr: google.ctr ?? null,
    google_conversions: google.conversions ?? null,
    google_revenue: google.revenue ?? null,
    google_campaigns: google.campaigns ?? [],
    google_period_start: google.period_start ?? null,
    google_period_end: google.period_end ?? null,
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Parse YYYY-MM into year and month integers
  const [yearStr, monthStr] = monthParam.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  // Verify client belongs to org
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('marketing_reports')
    .select('*')
    .eq('client_id', params.id)
    .eq('organization_id', userData.organization_id)
    .eq('year', year)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-calculate SEO counts from submission tables for this month
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  // Get client's project ids for this org
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', params.id)
    .eq('organization_id', userData.organization_id)

  const projectIds = (projects || []).map((p: any) => p.id)

  let seoOffpageCount = 0, seoBlogCount = 0, seoOnpageCount = 0
  if (projectIds.length > 0) {
    const [offpageRes, blogRes, onpageRes] = await Promise.all([
      supabase.from('offpage_submissions')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase.from('blog_submissions')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase.from('onpage_details')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
    ])
    seoOffpageCount = offpageRes.count ?? 0
    seoBlogCount = blogRes.count ?? 0
    seoOnpageCount = onpageRes.count ?? 0
  }

  const seoData = { seo_offpage_count: seoOffpageCount, seo_blog_count: seoBlogCount, seo_onpage_count: seoOnpageCount }

  const flattened = (data || []).map(flattenReport)
  if (flattened.length === 0) {
    return NextResponse.json([{ ...seoData }])
  }
  return NextResponse.json(flattened.map(r => ({ ...r, ...seoData })))
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const monthParam: string = body.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [yearStr, monthStr] = monthParam.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  const upsertData: Record<string, any> = {
    client_id: params.id,
    organization_id: userData.organization_id,
    year,
    month,
    updated_at: new Date().toISOString(),
  }

  // Support both flat-field input (legacy) and JSONB input
  if (body.meta_ads_data) {
    upsertData.meta_ads_data = body.meta_ads_data
  } else if (body.meta_impressions != null) {
    upsertData.meta_ads_data = {
      impressions: body.meta_impressions,
      clicks: body.meta_clicks,
      spend: body.meta_spend,
      roas: body.meta_roas,
      reach: body.meta_reach,
      ctr: body.meta_ctr,
      conversions: body.meta_conversions,
    }
  }

  if (body.google_ads_data) {
    upsertData.google_ads_data = body.google_ads_data
  } else if (body.google_impressions != null) {
    upsertData.google_ads_data = {
      impressions: body.google_impressions,
      clicks: body.google_clicks,
      spend: body.google_spend,
      roas: body.google_roas,
      ctr: body.google_ctr,
      conversions: body.google_conversions,
    }
  }

  if (body.notes) upsertData.notes = body.notes

  const { data, error } = await supabase
    .from('marketing_reports')
    .upsert(upsertData, { onConflict: 'client_id,year,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(flattenReport(data))
}
