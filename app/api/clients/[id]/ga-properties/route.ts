import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleToken, getOrgId } from '@/lib/google-oauth'

// List the GA4 properties the connected Google account can access.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getGoogleToken(supabase, orgId)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 403 })

  try {
    const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message || 'ga_error' }, { status: 502 })

    const properties: { property_id: string; display_name: string }[] = []
    for (const account of data.accountSummaries || []) {
      for (const p of account.propertySummaries || []) {
        // property is like "properties/123456789"
        const property_id = (p.property || '').replace('properties/', '')
        properties.push({
          property_id,
          display_name: `${p.displayName}${account.displayName ? ` — ${account.displayName}` : ''}`,
        })
      }
    }
    return NextResponse.json(properties)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load GA properties' }, { status: 500 })
  }
}

// Save the chosen GA4 property onto the client.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ga_property_id = body.property_id || body.ga_property_id || null
  const ga_property_name = body.display_name || body.ga_property_name || null
  if (!ga_property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  const { error } = await supabase
    .from('clients')
    .update({ ga_property_id, ga_property_name })
    .eq('id', params.id)
    .eq('organization_id', orgId)

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'clients table unavailable' }, { status: 200 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ga_property_id, ga_property_name })
}
