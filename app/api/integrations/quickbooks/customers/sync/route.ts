import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'
import { requireRole, BILLING_ROLES, MANAGER_ROLES } from '@/lib/authz'

const QB_BASE = process.env.QUICKBOOKS_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com'

// POST /api/integrations/quickbooks/customers/sync
// Pulls QB customers and links them to existing org clients by storing
// clients.qb_customer_id. Matches by (1) existing qb_customer_id, then
// (2) exact company_name, then (3) email. Returns { matched, unmatched }.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Allow either billing or manager roles.
  const authz = await requireRole(supabase, user.id, [...BILLING_ROLES, ...MANAGER_ROLES])
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  const orgId = authz.organizationId

  let token: string, realmId: string
  try {
    const t = await getQBToken(supabase)
    token = t.token
    realmId = t.realmId
  } catch {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
  }

  const query = encodeURIComponent('SELECT * FROM Customer MAXRESULTS 1000')
  const res = await fetch(`${QB_BASE}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: `QB request failed: ${res.status}`, detail }, { status: 502 })
  }

  const data = await res.json()
  const qbCustomers: any[] = data.QueryResponse?.Customer || []

  // Preload org clients for matching (tolerant of a missing qb_customer_id column).
  let clientRows: any[] = []
  for (const sel of ['id, company_name, email, qb_customer_id', 'id, company_name, email']) {
    const r = await supabase.from('clients').select(sel).eq('organization_id', orgId)
    if (!r.error) { clientRows = (r.data as any[]) || []; break }
    if (!/Could not find|does not exist|schema cache/i.test(r.error.message || '')) break
  }

  const byQbId = new Map<string, any>()
  const byName = new Map<string, any>()
  const byEmail = new Map<string, any>()
  for (const c of clientRows) {
    if (c.qb_customer_id) byQbId.set(String(c.qb_customer_id), c)
    if (c.company_name) byName.set(String(c.company_name).trim().toLowerCase(), c)
    if (c.email) byEmail.set(String(c.email).trim().toLowerCase(), c)
  }

  const linkedClientIds = new Set<string>()
  let matched = 0
  const unmatched: { qb_id: string; name: string }[] = []

  for (const c of qbCustomers) {
    const qbId = String(c.Id)
    const name = c.DisplayName || c.CompanyName || c.FullyQualifiedName || qbId
    const email = c.PrimaryEmailAddr?.Address ? String(c.PrimaryEmailAddr.Address).trim().toLowerCase() : null

    const client =
      byQbId.get(qbId) ||
      byName.get(String(name).trim().toLowerCase()) ||
      (email ? byEmail.get(email) : null)

    if (!client || linkedClientIds.has(client.id)) {
      if (!client) unmatched.push({ qb_id: qbId, name })
      continue
    }

    // Tolerant update: skip silently if the qb_customer_id column doesn't exist yet.
    const upd = await supabase
      .from('clients')
      .update({ qb_customer_id: qbId })
      .eq('id', client.id)
      .eq('organization_id', orgId)

    if (upd.error) {
      if (upd.error.code === '42P01' || /Could not find|does not exist|schema cache/i.test(upd.error.message || '')) {
        return NextResponse.json({ error: 'QB customer link not set up yet. Run migration 036.' }, { status: 503 })
      }
      unmatched.push({ qb_id: qbId, name })
      continue
    }

    linkedClientIds.add(client.id)
    matched++
  }

  return NextResponse.json({ matched, unmatched })
}
