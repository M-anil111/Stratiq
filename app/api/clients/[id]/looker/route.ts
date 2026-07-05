import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/google-oauth'
import { isLookerUrl } from '@/lib/looker'

// GET the client's saved Looker Studio published report URL (org-scoped).
// Also returns the client's GA4 property id so the marketing page can seed a
// Linking API "create from template" URL. Tolerant to a missing table/column.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('clients')
    .select('looker_report_url, ga_property_id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  // 42P01 = undefined_table, 42703 = undefined_column → treat as not configured
  if (error && (error.code === '42P01' || error.code === '42703')) {
    return NextResponse.json({ looker_report_url: null, ga_property_id: null })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    looker_report_url: data?.looker_report_url ?? null,
    ga_property_id: data?.ga_property_id ?? null,
  })
}

// PUT { looker_report_url } — save the client's published Looker Studio URL.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { looker_report_url?: string }
  const url = (body.looker_report_url ?? '').trim()

  if (!isLookerUrl(url)) {
    return NextResponse.json({ error: 'Must be a lookerstudio.google.com URL' }, { status: 400 })
  }

  const { error } = await supabase
    .from('clients')
    .update({ looker_report_url: url || null })
    .eq('id', params.id)
    .eq('organization_id', orgId)

  if (error && (error.code === '42P01' || error.code === '42703')) {
    return NextResponse.json({ error: 'Looker Studio storage not yet migrated' }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, looker_report_url: url || null })
}
