import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken, getOrgId } from '@/lib/google-oauth'

// List the verified Google Search Console sites the account can access.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getGoogleToken(supabase, orgId)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 403 })

  try {
    const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message || 'gsc_error' }, { status: 502 })

    const sites = (data.siteEntry || [])
      .map((s: any) => ({ site_url: s.siteUrl, permission: s.permissionLevel }))
      .filter((s: any) => s.permission !== 'siteUnverifiedUser')
    return NextResponse.json(sites)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load GSC sites' }, { status: 500 })
  }
}

// Save the chosen GSC site onto the client.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const gsc_site_url = body.site_url || body.gsc_site_url || null
  if (!gsc_site_url) return NextResponse.json({ error: 'site_url required' }, { status: 400 })

  const { error } = await supabase
    .from('clients')
    .update({ gsc_site_url })
    .eq('id', params.id)
    .eq('organization_id', orgId)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'clients table unavailable' }, { status: 200 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, gsc_site_url })
}
