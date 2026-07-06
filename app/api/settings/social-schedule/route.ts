import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'

// HubSpot-style custom social publishing schedule.
// Stored per org in organization_settings key `social_publishing_schedule` (jsonb value):
//   { times: { mon: string[], ..., sun: string[] }, publishLikeAHuman: boolean }
// where each time is a "HH:MM" 24h string. Times are the org's preferred publish slots.

const SETTINGS_KEY = 'social_publishing_schedule'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = (typeof DAYS)[number]

type Schedule = {
  times: Record<Day, string[]>
  publishLikeAHuman: boolean
}

function emptyTimes(): Record<Day, string[]> {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
}

function defaultSchedule(): Schedule {
  return { times: emptyTimes(), publishLikeAHuman: false }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function sanitize(input: unknown): Schedule {
  const out = defaultSchedule()
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, any>
  const times = (src.times && typeof src.times === 'object' ? src.times : {}) as Record<string, any>
  for (const day of DAYS) {
    const raw = Array.isArray(times[day]) ? times[day] : []
    // Keep only valid HH:MM strings, de-duplicate, and sort chronologically.
    const seen = new Set<string>()
    const cleaned: string[] = []
    for (const t of raw) {
      if (typeof t === 'string' && TIME_RE.test(t) && !seen.has(t)) {
        seen.add(t)
        cleaned.push(t)
      }
    }
    cleaned.sort()
    out.times[day] = cleaned
  }
  out.publishLikeAHuman = src.publishLikeAHuman === true
  return out
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    const organizationId = (userData as any)?.organization_id
    if (!organizationId) return NextResponse.json({ schedule: defaultSchedule() })

    const { data, error } = await supabase
      .from('organization_settings')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    if (error) {
      // 42P01 = missing table → return defaults gracefully.
      return NextResponse.json({ schedule: defaultSchedule() })
    }

    const value = (data as any)?.value
    // Value may be stored as an object (jsonb) or a JSON string; handle both.
    let parsed: unknown = value
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value) } catch { parsed = null }
    }
    return NextResponse.json({ schedule: sanitize(parsed) })
  } catch {
    return NextResponse.json({ schedule: defaultSchedule() })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, MANAGER_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await request.json() } catch { body = {} }

  const incoming = (body?.schedule && typeof body.schedule === 'object') ? body.schedule : body
  const schedule = sanitize(incoming)

  const upsert = async (value: any) =>
    supabase
      .from('organization_settings')
      .upsert(
        {
          organization_id: authz.organizationId,
          key: SETTINGS_KEY,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,key' }
      )

  try {
    // Try storing as a jsonb object first; fall back to a JSON string if the
    // column is text-typed.
    const { error } = await upsert(schedule)
    if (error) {
      const { error: e2 } = await upsert(JSON.stringify(schedule))
      if (e2) {
        // Missing table/column → treat as a graceful no-op.
        return NextResponse.json({ schedule, saved: false })
      }
    }
  } catch {
    return NextResponse.json({ schedule, saved: false })
  }

  return NextResponse.json({ schedule, saved: true })
}
