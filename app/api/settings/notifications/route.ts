import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Per-user notification preferences center.
//
// Preferences are stored on users.notification_preferences (jsonb) as:
//   { muteAll: boolean, pauseEmail: boolean, events: { [eventKey]: { inapp: boolean, email: boolean } } }
//
// The column is added by migration 043_notification_prefs.sql. If the column (42703)
// or table (42P01) is missing we degrade gracefully and return sensible defaults
// (everything on) so the UI keeps working before the migration is applied.
//
// NOTE: lib/notify.ts does NOT yet consult these preferences — this route only
// persists the user's choices. A follow-up can have notify() read this column and
// filter recipients / suppress email per the stored map.

type Channels = { inapp: boolean; email: boolean }
type EventsMap = Record<string, Channels>
type Prefs = { muteAll: boolean; pauseEmail: boolean; events: EventsMap }

// Every configurable event, aligned with lib/notify.ts notification types.
// Security is non-optional (locked on).
const DEFAULT_EVENTS: EventsMap = {
  // Social publishing
  publish_success: { inapp: true, email: false },
  publish_failed: { inapp: true, email: true },
  reconnect: { inapp: true, email: true },
  token_expiry: { inapp: true, email: true },
  // Approvals
  approval_needed: { inapp: true, email: true },
  approval_approved: { inapp: true, email: false },
  approval_rejected: { inapp: true, email: true },
  // Reports
  report_scheduled: { inapp: true, email: true },
  // Billing & invoices
  invoice_paid: { inapp: true, email: true },
  invoice_overdue: { inapp: true, email: true },
  // System
  security_alert: { inapp: true, email: true },
  product_updates: { inapp: true, email: false },
}

// Events that can never be fully disabled (account safety).
const LOCKED = new Set(['security_alert'])

function defaults(): Prefs {
  return { muteAll: false, pauseEmail: false, events: { ...DEFAULT_EVENTS } }
}

function mergeOverDefaults(stored: unknown): Prefs {
  const base = defaults()
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, any>
  const events: EventsMap = {}
  const storedEvents = (s.events && typeof s.events === 'object' ? s.events : {}) as Record<string, any>
  for (const [key, def] of Object.entries(DEFAULT_EVENTS)) {
    const row = storedEvents[key] && typeof storedEvents[key] === 'object' ? storedEvents[key] : {}
    events[key] = {
      inapp: typeof row.inapp === 'boolean' ? row.inapp : def.inapp,
      email: typeof row.email === 'boolean' ? row.email : def.email,
    }
    // Locked events are always fully on regardless of what was stored.
    if (LOCKED.has(key)) events[key] = { inapp: true, email: true }
  }
  return {
    muteAll: typeof s.muteAll === 'boolean' ? s.muteAll : base.muteAll,
    pauseEmail: typeof s.pauseEmail === 'boolean' ? s.pauseEmail : base.pauseEmail,
    events,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      // 42703 (missing column) / 42P01 (missing table) → sensible defaults.
      return NextResponse.json({ prefs: mergeOverDefaults(null) })
    }
    return NextResponse.json({ prefs: mergeOverDefaults((data as any)?.notification_preferences) })
  } catch {
    return NextResponse.json({ prefs: mergeOverDefaults(null) })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await request.json() } catch { body = {} }

  const incoming = (body?.prefs && typeof body.prefs === 'object') ? body.prefs : body
  const merged = mergeOverDefaults(incoming)

  try {
    const { error } = await supabase
      .from('users')
      .update({ notification_preferences: merged })
      .eq('id', user.id)

    if (error) {
      // Missing column/table → treat save as a graceful no-op so the UI stays usable.
      return NextResponse.json({ prefs: merged, saved: false })
    }
  } catch {
    return NextResponse.json({ prefs: merged, saved: false })
  }

  return NextResponse.json({ prefs: merged, saved: true })
}
