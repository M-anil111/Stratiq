import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Default customizable dashboard layout: ordered widget keys + hidden set.
const DEFAULT_LAYOUT = {
  order: [
    'kpi',
    'dashboard-stats',
    'social-failed',
    'social-awaiting',
    'social-scheduled-today',
    'social-scheduled-week',
    'social-recently-published',
    'quick-actions',
    'top-clients',
    'activity',
  ],
  hidden: [] as string[],
}

function normalize(raw: any) {
  if (!raw || typeof raw !== 'object') return DEFAULT_LAYOUT
  const order = Array.isArray(raw.order) ? raw.order.filter((k: any) => typeof k === 'string') : []
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((k: any) => typeof k === 'string') : []
  // Merge in any new default widgets that aren't yet in the saved order.
  const merged = [...order, ...DEFAULT_LAYOUT.order.filter(k => !order.includes(k))]
  return { order: merged.length ? merged : DEFAULT_LAYOUT.order, hidden }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase.from('users').select('dashboard_layout').eq('id', user.id).single()
    // Missing column (42703) / missing table (42P01) → fall back to default.
    if (error?.code === '42703' || error?.code === '42P01') {
      return NextResponse.json(DEFAULT_LAYOUT)
    }
    if (error || !data?.dashboard_layout) return NextResponse.json(DEFAULT_LAYOUT)
    return NextResponse.json(normalize(data.dashboard_layout))
  } catch {
    return NextResponse.json(DEFAULT_LAYOUT)
  }
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const layout = normalize(body)

  try {
    const { error } = await supabase.from('users').update({ dashboard_layout: layout }).eq('id', user.id)
    // Tolerate the column not existing yet (pre-migration-040): still report ok.
    if (error?.code === '42703' || error?.code === '42P01') {
      return NextResponse.json({ ok: true, persisted: false, layout })
    }
    if (error) return NextResponse.json({ ok: true, persisted: false, layout })
    return NextResponse.json({ ok: true, persisted: true, layout })
  } catch {
    return NextResponse.json({ ok: true, persisted: false, layout })
  }
}
