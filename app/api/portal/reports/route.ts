import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get('month')

  let query = supabase
    .from('marketing_reports')
    .select('id, year, month, google_ads_data, meta_ads_data, notes, created_at')
    .eq('client_id', portalAccess.client_id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
    query = query.eq('year', y).eq('month', m)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const flatten = (row: any) => {
    const g = row.google_ads_data || {}
    const m = row.meta_ads_data || {}
    return {
      id: row.id,
      year: row.year,
      month: row.month,
      notes: row.notes,
      created_at: row.created_at,
      google: {
        impressions: g.impressions ?? null,
        clicks: g.clicks ?? null,
        conversions: g.conversions ?? null,
        spend: g.spend ?? null,
        roas: g.roas ?? null,
        ctr: g.ctr ?? null,
        revenue: g.revenue ?? null,
        campaigns: g.campaigns ?? [],
      },
      meta: {
        impressions: m.impressions ?? null,
        clicks: m.clicks ?? null,
        conversions: m.conversions ?? null,
        spend: m.spend ?? null,
        roas: m.roas ?? null,
        ctr: m.ctr ?? null,
        reach: m.reach ?? null,
        revenue: m.revenue ?? null,
      },
    }
  }

  return NextResponse.json((data || []).map(flatten))
}
