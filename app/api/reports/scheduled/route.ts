import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Scheduled report auto-send. Persists rows in the report_schedules table
// (migration 042). Falls back to the organization_settings JSON store when the
// table is missing (42P01) so the feature keeps working pre-migration.

const SETTINGS_KEY = 'scheduled_reports'

function missingRelation(error: any): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === '42703') return true
  return /does not exist|Could not find|schema cache/i.test(error.message || '')
}

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, supabase, user: null, orgId: null }
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return { error: 'No organization', status: 403 as const, supabase, user, orgId: null }
  return { error: null, status: 200 as const, supabase, user, orgId: userData.organization_id as string }
}

// Map a DB row / stored object to the UI shape.
function toApi(r: any) {
  return {
    id: String(r.id),
    client_id: r.client_id ?? null,
    client: r.client_name ?? r.client ?? 'Unknown Client',
    type: r.report_type ?? r.type ?? 'Marketing Summary',
    frequency: r.frequency ?? 'Monthly',
    day: r.day ?? '',
    recipients: Array.isArray(r.recipients) ? r.recipients : [],
    status: r.status ?? 'active',
    nextRun: r.last_sent_at ? 'Scheduled' : 'Scheduled',
    created_at: r.created_at ?? null,
  }
}

async function readSettings(supabase: any, orgId: string): Promise<any[]> {
  const { data } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  try { return data?.value ? JSON.parse(data.value) : [] } catch { return [] }
}

async function writeSettings(supabase: any, orgId: string, rows: any[]) {
  await supabase
    .from('organization_settings')
    .upsert(
      { organization_id: orgId, key: SETTINGS_KEY, value: JSON.stringify(rows), updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,key' },
    )
}

export async function GET() {
  const auth = await getAuth()
  if (auth.error) return NextResponse.json([])
  const { supabase } = auth; const orgId = auth.orgId as string

  const res = await supabase
    .from('report_schedules')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (!res.error) return NextResponse.json((res.data || []).map(toApi))
  if (!missingRelation(res.error)) return NextResponse.json([])
  const rows = await readSettings(supabase, orgId)
  return NextResponse.json(rows.map(toApi))
}

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, user } = auth; const orgId = auth.orgId as string

  const body = await req.json()
  const row: any = {
    organization_id: orgId,
    client_id: body.client_id || null,
    client_name: body.client || null,
    report_type: body.type || null,
    report_definition_id: body.report_definition_id || null,
    frequency: body.frequency || 'Monthly',
    day: body.day != null ? String(body.day) : null,
    recipients: body.recipients || [],
    status: 'active',
    created_by: user?.id || null,
  }

  const res = await supabase.from('report_schedules').insert(row).select().single()
  if (!res.error) return NextResponse.json(toApi(res.data), { status: 201 })
  if (!missingRelation(res.error)) return NextResponse.json({ error: res.error.message }, { status: 500 })

  // Fallback to settings JSON.
  const rows = await readSettings(supabase, orgId)
  const stored = { ...row, id: `${Date.now()}`, created_at: new Date().toISOString() }
  rows.unshift(stored)
  await writeSettings(supabase, orgId, rows)
  return NextResponse.json(toApi(stored), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth; const orgId = auth.orgId as string

  const { id, status } = await req.json()
  const res = await supabase
    .from('report_schedules')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (!res.error) return NextResponse.json(res.data ? toApi(res.data) : { ok: true })
  if (!missingRelation(res.error)) return NextResponse.json({ error: res.error.message }, { status: 500 })

  const rows = await readSettings(supabase, orgId)
  const next = rows.map((s: any) => (String(s.id) === String(id) ? { ...s, status } : s))
  await writeSettings(supabase, orgId, next)
  const updated = next.find((s: any) => String(s.id) === String(id))
  return NextResponse.json(updated ? toApi(updated) : { ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth; const orgId = auth.orgId as string

  const { id } = await req.json()
  const res = await supabase.from('report_schedules').delete().eq('organization_id', orgId).eq('id', id)
  if (!res.error) return NextResponse.json({ ok: true })
  if (!missingRelation(res.error)) return NextResponse.json({ error: res.error.message }, { status: 500 })

  const rows = await readSettings(supabase, orgId)
  await writeSettings(supabase, orgId, rows.filter((s: any) => String(s.id) !== String(id)))
  return NextResponse.json({ ok: true })
}
