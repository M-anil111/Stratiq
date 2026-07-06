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

async function runReport(token: string, propertyId: string, body: any) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

const SUMMARY_METRICS = [
  'sessions',
  'totalUsers',
  'screenPageViews',
  'newUsers',
  'averageSessionDuration',
  'screenPageViewsPerSession',
]

function metricRow(report: any, rangeIndex = 0) {
  // With multiple dateRanges GA4 returns one row per range with a dateRange dimension.
  const rows = report?.rows || []
  const row = rows.find((r: any) => (r.dimensionValues?.[0]?.value || 'date_range_0') === `date_range_${rangeIndex}`) || rows[rangeIndex] || rows[0]
  const out: Record<string, number> = {}
  const headers = report?.metricHeaders || []
  headers.forEach((h: any, i: number) => {
    out[h.name] = Number(row?.metricValues?.[i]?.value || 0)
  })
  return out
}

function breakdown(report: any) {
  return (report?.rows || []).map((r: any) => ({
    label: r.dimensionValues?.[0]?.value || '(not set)',
    sessions: Number(r.metricValues?.[0]?.value || 0),
    users: Number(r.metricValues?.[1]?.value || 0),
  }))
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('ga_property_id, ga_property_name')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (clientErr && clientErr.code === '42P01') return NextResponse.json({ __unlinked: true })
  if (!client?.ga_property_id) return NextResponse.json({ __unlinked: true })

  const token = await getGoogleToken(supabase, orgId)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const def = defaultRange()
  const start = searchParams.get('start') || def.start
  const end = searchParams.get('end') || def.end
  const prevStart = searchParams.get('prevStart')
  const prevEnd = searchParams.get('prevEnd')

  const dateRanges = [{ startDate: start, endDate: end }]
  if (prevStart && prevEnd) dateRanges.push({ startDate: prevStart, endDate: prevEnd })

  const propertyId = client.ga_property_id

  try {
    const [summaryRep, sourcesRep, countriesRep, devicesRep, dailyRep] = await Promise.all([
      runReport(token, propertyId, {
        dateRanges,
        metrics: SUMMARY_METRICS.map((name) => ({ name })),
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      }),
    ])

    if (summaryRep?.error) {
      return NextResponse.json({ error: summaryRep.error.message || 'ga_error' }, { status: 502 })
    }

    const current = metricRow(summaryRep, 0)
    const previous = dateRanges.length > 1 ? metricRow(summaryRep, 1) : null

    const timeseries = (dailyRep?.rows || []).map((r: any) => {
      const d = r.dimensionValues?.[0]?.value || '' // YYYYMMDD
      const iso = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d
      return { date: iso, sessions: Number(r.metricValues?.[0]?.value || 0), users: Number(r.metricValues?.[1]?.value || 0) }
    })

    return NextResponse.json({
      property_id: propertyId,
      property_name: client.ga_property_name,
      range: { start, end },
      summary: {
        sessions: current.sessions || 0,
        users: current.totalUsers || 0,
        pageviews: current.screenPageViews || 0,
        newSessions: current.newUsers || 0,
        avgSessionDuration: current.averageSessionDuration || 0,
        pagesPerSession: current.screenPageViewsPerSession || 0,
      },
      previous: previous
        ? {
            sessions: previous.sessions || 0,
            users: previous.totalUsers || 0,
            pageviews: previous.screenPageViews || 0,
            newSessions: previous.newUsers || 0,
            avgSessionDuration: previous.averageSessionDuration || 0,
            pagesPerSession: previous.screenPageViewsPerSession || 0,
          }
        : null,
      trafficSources: breakdown(sourcesRep),
      countries: breakdown(countriesRep),
      devices: breakdown(devicesRep),
      timeseries,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load analytics' }, { status: 500 })
  }
}
