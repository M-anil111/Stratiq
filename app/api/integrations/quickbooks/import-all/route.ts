import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const QB_BASE = process.env.QUICKBOOKS_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com'

// A Postgres/PostgREST error means "table or column is missing" so we can fall
// back gracefully instead of hard-failing.
function isMissingSchema(err: any): boolean {
  if (!err) return false
  const code = err.code
  if (code === '42P01' || code === '42703') return true
  return /Could not find|does not exist|schema cache|relationship/i.test(err.message || '')
}

function firstEmail(c: any): string | null {
  const e = c?.PrimaryEmailAddr?.Address
  return e ? String(e).trim() : null
}

function firstPhone(c: any): string | null {
  const p = c?.PrimaryPhone?.FreeFormNumber
    || c?.Mobile?.FreeFormNumber
    || c?.AlternatePhone?.FreeFormNumber
  return p ? String(p).trim() : null
}

// A human contact name from a QB customer (person name preferred, else company).
function contactName(c: any): string | null {
  const person = [c?.GivenName, c?.MiddleName, c?.FamilyName].filter(Boolean).join(' ').trim()
  const name = person || c?.DisplayName || c?.CompanyName || c?.FullyQualifiedName
  return name ? String(name).trim() : null
}

// POST /api/integrations/quickbooks/import-all
// Pulls ALL QuickBooks customers (paginated), upserting each into Stratiq's
// `clients` table and creating/linking a row in `contacts`. Idempotent: matches
// existing clients by stored qb_customer_id, then company_name, then email.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, MANAGER_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  const orgId = authz.organizationId

  let token: string, realmId: string
  try {
    const t = await getQBToken(supabase)
    token = t.token
    realmId = t.realmId
  } catch (err: any) {
    const msg = err?.message === 'QuickBooks not connected'
      ? 'QuickBooks is not connected. Connect it first, then try again.'
      : (err?.message || 'QuickBooks authorization failed.')
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // --- 1. Pull ALL QB customers, paginating with startPosition/MAXRESULTS ---
  const PAGE = 1000
  const qbCustomers: any[] = []
  let start = 1
  try {
    // Guard against runaway loops; 200 pages * 1000 = 200k customers max.
    for (let i = 0; i < 200; i++) {
      const q = `SELECT * FROM Customer STARTPOSITION ${start} MAXRESULTS ${PAGE}`
      const url = `${QB_BASE}/v3/company/${realmId}/query?query=${encodeURIComponent(q)}&minorversion=65`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return NextResponse.json(
          { error: `QuickBooks request failed (${res.status}).`, detail: detail.slice(0, 500) },
          { status: 502 },
        )
      }
      const data = await res.json()
      const batch: any[] = data.QueryResponse?.Customer || []
      qbCustomers.push(...batch)
      if (batch.length < PAGE) break
      start += PAGE
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to reach QuickBooks: ${err?.message || 'network error'}` }, { status: 502 })
  }

  // --- 2. Detect whether the clients.qb_customer_id link column exists ---
  let hasLinkColumn = true
  {
    const probe = await supabase.from('clients').select('qb_customer_id').eq('organization_id', orgId).limit(1)
    if (probe.error && isMissingSchema(probe.error)) hasLinkColumn = false
    else if (probe.error) {
      return NextResponse.json({ error: probe.error.message }, { status: 500 })
    }
  }

  // Preload existing clients for matching.
  const clientSelect = hasLinkColumn ? 'id, company_name, email, qb_customer_id' : 'id, company_name, email'
  const clientRes = await supabase.from('clients').select(clientSelect).eq('organization_id', orgId)
  if (clientRes.error) {
    if (clientRes.error.code === '42P01') {
      return NextResponse.json({ error: 'The clients table is not set up in this database.' }, { status: 503 })
    }
    return NextResponse.json({ error: clientRes.error.message }, { status: 500 })
  }
  const clientRows: any[] = (clientRes.data as any[]) || []

  const byQbId = new Map<string, any>()
  const byName = new Map<string, any>()
  const byEmail = new Map<string, any>()
  for (const c of clientRows) {
    if (c.qb_customer_id) byQbId.set(String(c.qb_customer_id), c)
    if (c.company_name) byName.set(String(c.company_name).trim().toLowerCase(), c)
    if (c.email) byEmail.set(String(c.email).trim().toLowerCase(), c)
  }

  // Detect whether the contacts table exists (once).
  let hasContactsTable = true
  {
    const probe = await supabase.from('contacts').select('id').eq('organization_id', orgId).limit(1)
    if (probe.error && (probe.error.code === '42P01' || isMissingSchema(probe.error))) hasContactsTable = false
  }

  let imported = 0
  let updated = 0
  let contactsUpserted = 0
  let skipped = 0
  const errors: string[] = []
  const handledClientIds = new Set<string>()

  for (const c of qbCustomers) {
    const qbId = String(c.Id)
    const company = c.CompanyName || c.DisplayName || c.FullyQualifiedName || null
    const email = firstEmail(c)
    const phone = firstPhone(c)
    const addr = c.BillAddr || c.ShipAddr || {}

    if (!company && !email) { skipped++; continue }

    // Map QB fields → Stratiq client columns.
    const clientFields: Record<string, any> = {
      company_name: company || email || qbId,
      email: email || null,
      phone: phone || null,
      street_address: [addr.Line1, addr.Line2, addr.Line3, addr.Line4].filter(Boolean).join(', ') || null,
      city: addr.City || null,
      state: addr.CountrySubDivisionCode || null,
      country: addr.Country || null,
    }

    // Find an existing client to update.
    const existing =
      byQbId.get(qbId) ||
      (company ? byName.get(String(company).trim().toLowerCase()) : null) ||
      (email ? byEmail.get(email.trim().toLowerCase()) : null)

    let clientId: string | null = null

    if (existing) {
      clientId = existing.id
      if (!handledClientIds.has(existing.id)) {
        // Update only fields that carry a value, so we never wipe existing data.
        const updateRow: Record<string, any> = { updated_at: new Date().toISOString() }
        for (const [k, v] of Object.entries(clientFields)) {
          if (v !== null && v !== undefined && v !== '') updateRow[k] = v
        }
        if (hasLinkColumn) updateRow.qb_customer_id = qbId

        let updRes = await tolerantWrite(() =>
          supabase.from('clients').update(updateRow).eq('id', existing.id).eq('organization_id', orgId),
          updateRow,
        )
        if (updRes.error) {
          errors.push(`Update failed for "${clientFields.company_name}": ${updRes.error.message}`)
        } else {
          updated++
        }
        handledClientIds.add(existing.id)
      }
    } else {
      // Insert a new client.
      const insertRow: Record<string, any> = {
        organization_id: orgId,
        project_status: 'active',
        ...clientFields,
      }
      if (hasLinkColumn) insertRow.qb_customer_id = qbId

      const insRes = await tolerantWrite(
        () => supabase.from('clients').insert(insertRow).select('id').single(),
        insertRow,
      )
      if (insRes.error || !insRes.data) {
        errors.push(`Import failed for "${clientFields.company_name}": ${insRes.error?.message || 'unknown error'}`)
        continue
      }
      clientId = (insRes.data as any).id
      imported++
      // Register in match maps so a duplicate QB row in the same run reuses it.
      const newRow = { id: clientId, company_name: clientFields.company_name, email: clientFields.email, qb_customer_id: qbId }
      byQbId.set(qbId, newRow)
      if (clientFields.company_name) byName.set(String(clientFields.company_name).trim().toLowerCase(), newRow)
      if (clientFields.email) byEmail.set(String(clientFields.email).trim().toLowerCase(), newRow)
      handledClientIds.add(clientId!)
    }

    // --- Create / link a contact for this client ---
    if (clientId && hasContactsTable) {
      const cName = contactName(c)
      if (cName || email || phone) {
        try {
          // Idempotent: look for an existing contact for this client that matches
          // by email (preferred) or name, and update it; otherwise insert.
          let match: any = null
          const q = await supabase
            .from('contacts')
            .select('id, name, email')
            .eq('organization_id', orgId)
            .eq('client_id', clientId)
          if (!q.error && Array.isArray(q.data)) {
            match =
              (email && q.data.find((x: any) => x.email && String(x.email).trim().toLowerCase() === email.trim().toLowerCase())) ||
              (cName && q.data.find((x: any) => x.name && String(x.name).trim().toLowerCase() === cName.trim().toLowerCase())) ||
              null
          }

          const contactRow: Record<string, any> = {
            organization_id: orgId,
            client_id: clientId,
            name: cName || null,
            email: email || null,
            phone: phone || null,
          }

          if (match) {
            const upd = await supabase.from('contacts').update(contactRow).eq('id', match.id).eq('organization_id', orgId)
            if (!upd.error) contactsUpserted++
            else if (!isMissingSchema(upd.error)) errors.push(`Contact update failed for "${cName || email}": ${upd.error.message}`)
          } else {
            const ins = await supabase.from('contacts').insert(contactRow)
            if (!ins.error) contactsUpserted++
            else if (ins.error.code === '42P01' || isMissingSchema(ins.error)) hasContactsTable = false
            else errors.push(`Contact create failed for "${cName || email}": ${ins.error.message}`)
          }
        } catch (err: any) {
          errors.push(`Contact error for "${cName || email}": ${err?.message || 'unknown'}`)
        }
      }
    }
  }

  return NextResponse.json({
    imported,
    updated,
    contacts: contactsUpserted,
    skipped,
    total: qbCustomers.length,
    linkColumn: hasLinkColumn,
    contactsTable: hasContactsTable,
    errors: errors.slice(0, 50),
  })
}

// Run a Supabase write, retrying while stripping columns PostgREST reports as
// missing from the schema cache (so imports succeed with whatever columns exist).
async function tolerantWrite(
  run: () => any,
  row: Record<string, any>,
): Promise<{ data: any; error: any }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await run()
    if (!res.error) return { data: res.data ?? null, error: null }
    const missing = res.error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in row) {
      delete row[missing]
      continue
    }
    // A check-constraint violation shouldn't block the whole import — drop it.
    const checkViol = res.error.code === '23514' && res.error.message?.match(/clients_([a-z_]+)_check/)?.[1]
    if (checkViol && checkViol in row) {
      delete row[checkViol]
      continue
    }
    return { data: res.data ?? null, error: res.error }
  }
  return { data: null, error: { message: 'Too many schema retries' } }
}
