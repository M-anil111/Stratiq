import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// HubSpot-style notification preferences center.
// Stored per user as a JSON map: { [topicKey]: { email: bool, bell: bool, popup: bool } }
// in user_notification_prefs.prefs (jsonb). Legacy boolean columns are preserved so any
// older callers keep working, but the map is the source of truth for the new UI.

type Channels = { email: boolean; bell: boolean; popup: boolean }
type PrefsMap = Record<string, Channels>

// Sensible defaults: email on for high-signal topics, bell on for most, popup mostly off.
// Security topics are non-optional (always on) — enforced here as well as in the UI.
const DEFAULTS: PrefsMap = {
  // Clients & Contacts
  client_assigned: { email: true, bell: true, popup: false },
  client_added: { email: false, bell: true, popup: false },
  mention: { email: true, bell: true, popup: true },
  // Projects
  project_assigned: { email: true, bell: true, popup: false },
  project_status: { email: false, bell: true, popup: false },
  // Leads
  lead_assigned: { email: true, bell: true, popup: false },
  lead_stage: { email: false, bell: true, popup: false },
  // Invoices & Payments
  invoice_paid: { email: true, bell: true, popup: false },
  invoice_overdue: { email: true, bell: true, popup: false },
  payment_received: { email: true, bell: true, popup: false },
  // Messages
  client_message: { email: true, bell: true, popup: true },
  // Reports
  report_sent: { email: true, bell: true, popup: false },
  report_scheduled: { email: false, bell: true, popup: false },
  // Team
  invite_accepted: { email: false, bell: true, popup: false },
  role_changed: { email: true, bell: true, popup: false },
  // Approvals
  proposal_decision: { email: true, bell: true, popup: false },
  // Security (non-optional)
  suspicious_login: { email: true, bell: true, popup: true },
  new_signin: { email: true, bell: true, popup: false },
  // System
  import_complete: { email: false, bell: true, popup: false },
  export_ready: { email: false, bell: true, popup: false },
  integration_disconnected: { email: true, bell: true, popup: false },
  sync_error: { email: true, bell: true, popup: false },
}

// Topics that can never be fully disabled.
const LOCKED = new Set(['suspicious_login', 'new_signin'])

function mergeOverDefaults(stored: unknown): PrefsMap {
  const out: PrefsMap = {}
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, any>
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const row = s[key] && typeof s[key] === 'object' ? s[key] : {}
    out[key] = {
      email: typeof row.email === 'boolean' ? row.email : def.email,
      bell: typeof row.bell === 'boolean' ? row.bell : def.bell,
      popup: typeof row.popup === 'boolean' ? row.popup : def.popup,
    }
    if (LOCKED.has(key)) out[key] = { email: true, bell: true, popup: def.popup || out[key].popup }
  }
  return out
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase
      .from('user_notification_prefs')
      .select('prefs')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      // 42P01 = missing table, 42703 = missing column → return defaults gracefully
      return NextResponse.json({ prefs: mergeOverDefaults(null) })
    }
    return NextResponse.json({ prefs: mergeOverDefaults(data?.prefs) })
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

  // Determine organization for org-scoping (best-effort; column may not exist).
  let organization_id: string | null = null
  try {
    const { data: u } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()
    organization_id = (u as any)?.organization_id ?? null
  } catch { /* ignore */ }

  const attempt = async (payload: Record<string, any>) =>
    supabase
      .from('user_notification_prefs')
      .upsert(payload, { onConflict: 'user_id' })
      .select('prefs')
      .maybeSingle()

  try {
    const { error } = await attempt({
      user_id: user.id,
      organization_id,
      prefs: merged,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      // Retry without possibly-missing columns (prefs / organization_id).
      const { error: e2 } = await attempt({
        user_id: user.id,
        prefs: merged,
        updated_at: new Date().toISOString(),
      })
      if (e2) {
        // Missing table/column entirely → treat save as a graceful no-op.
        return NextResponse.json({ prefs: merged, saved: false })
      }
    }
  } catch {
    return NextResponse.json({ prefs: merged, saved: false })
  }

  return NextResponse.json({ prefs: merged, saved: true })
}
