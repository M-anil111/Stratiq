import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken, getOrgId } from '@/lib/google-oauth'

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

async function query(token: string, siteUrl: string, body: any) {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  return res.json()
}

function mapRows(data: any) {
  return (data?.rows || []).map((r: any) => ({
    key: r.keys?.[0] || '',
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }))
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('gsc_site_url')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (clientErr && clientErr.code === '42P01') return NextResponse.json({ __unlinked: true })
  if (!client?.gsc_site_url) return NextResponse.json({ __unlinked: true })

  const token = await getGoogleToken(supabase, orgId)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const def = defaultRange()
  const startDate = searchParams.get('start') || def.start
  const endDate = searchParams.get('end') || def.end
  const siteUrl = client.gsc_site_url

  try {
    const [totalsRep, dailyRep, queriesRep, pagesRep, countriesRep, devicesRep] = await Promise.all([
      query(token, siteUrl, { startDate, endDate }),
      query(token, siteUrl, { startDate, endDate, dimensions: ['date'], rowLimit: 400 }),
      query(token, siteUrl, { startDate, endDate, dimensions: ['query'], rowLimit: 50 }),
      query(token, siteUrl, { startDate, endDate, dimensions: ['page'], rowLimit: 50 }),
      query(token, siteUrl, { startDate, endDate, dimensions: ['country'], rowLimit: 50 }),
      query(token, siteUrl, { startDate, endDate, dimensions: ['device'], rowLimit: 50 }),
    ])

    if (totalsRep?.error) {
      return NextResponse.json({ error: totalsRep.error.message || 'gsc_error' }, { status: 502 })
    }

    const t = totalsRep?.rows?.[0] || {}
    const timeseries = (dailyRep?.rows || []).map((r: any) => ({
      date: r.keys?.[0] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }))

    return NextResponse.json({
      site_url: siteUrl,
      range: { start: startDate, end: endDate },
      summary: {
        clicks: t.clicks || 0,
        impressions: t.impressions || 0,
        ctr: t.ctr || 0,
        position: t.position || 0,
      },
      timeseries,
      queries: mapRows(queriesRep),
      pages: mapRows(pagesRep),
      countries: mapRows(countriesRep),
      devices: mapRows(devicesRep),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load search console' }, { status: 500 })
  }
}
