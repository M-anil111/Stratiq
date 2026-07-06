import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public, token-authenticated, read-only report endpoint.
// Returns ONLY report metrics + display names — nothing else.
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createAdminClient()

  const { data: share, error: shareError } = await supabase
    .from('report_share_tokens')
    .select('organization_id, client_id, month, expires_at')
    .eq('token', token)
    .single()

  if (shareError) {
    if (shareError.code === '42P01') {
      return NextResponse.json({ error: 'Share links not set up — run migration 019' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [yearStr, monthStr] = share.month.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  if (!year || !month) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [clientRes, orgSettingRes, reportRes] = await Promise.all([
    supabase
      .from('clients')
      .select('company_name')
      .eq('id', share.client_id)
      .eq('organization_id', share.organization_id)
      .single(),
    supabase
      .from('organization_settings')
      .select('value')
      .eq('organization_id', share.organization_id)
      .eq('key', 'company_name')
      .single(),
    supabase
      .from('marketing_reports')
      .select('meta_ads_data, google_ads_data, notes')
      .eq('client_id', share.client_id)
      .eq('organization_id', share.organization_id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
  ])

  if (!clientRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const meta = reportRes.data?.meta_ads_data || {}
  const google = reportRes.data?.google_ads_data || {}

  // SEO counts from submission tables for this month (same as reports route)
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', share.client_id)
    .eq('organization_id', share.organization_id)

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

  // Explicit whitelist — same flattened shape as flattenReport, but never
  // returning ids, org data, or anything beyond metrics + display names.
  return NextResponse.json({
    client_company_name: clientRes.data.company_name,
    agency_name: orgSettingRes.data?.value || 'Stratiq',
    month: share.month,
    notes: reportRes.data?.notes ?? null,
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
    google_period_start: google.period_start ?? null,
    google_period_end: google.period_end ?? null,
    // SEO counts
    seo_offpage_count: seoOffpageCount,
    seo_blog_count: seoBlogCount,
    seo_onpage_count: seoOnpageCount,
  })
}
