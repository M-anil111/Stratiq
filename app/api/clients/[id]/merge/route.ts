import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'

// HubSpot-style client merge. The primary record (URL param) survives; the
// secondary record's associations are re-pointed to the primary, its id is
// appended to primary.merged_client_ids, and the secondary row is deleted.
// NOTE: merges are NOT reversible (HubSpot behavior).

// Columns eligible for per-property choice during a merge (real columns from
// migrations 001/006/008/010/015)
const MERGEABLE_PROPS = [
  'company_name',
  'display_name',
  'website',
  'about_company',
  'industry',
  'email',
  'phone',
  'street_address',
  'city',
  'state',
  'country',
  'num_employees',
  'target_audience',
  'website_last_updated',
  'ndisk_link',
  'google_drive_folder_url',
  'google_drive_folder_id',
  'proposal_url',
  'google_place_id',
  'contact_first_name',
  'contact_last_name',
  'domain_name',
  'domain_registrar',
  'domain_expiry',
  'hosting_provider',
  'hosting_expiry',
  'nameservers',
  'hosting_notes',
  'client_degree',
  'client_pin',
  'maint_since',
  'maint_degree',
  'credit_status',
  'project_status',
  'sales_manager_id',
  'dm_manager_id',
  'marketing_manager_id',
  'service_packages',
  'services',
  'advertising_types',
  'goals',
  'stakeholder_expectations',
  'hashtags',
  'categories',
  'logo_urls',
] as const

// Tables holding a client_id FK that must be re-pointed to the primary.
// Each is updated individually and failures (e.g. 42P01 missing table on
// older environments) are tolerated.
const ASSOCIATION_TABLES = [
  'projects',
  'invoices',
  'messages',
  'marketing_reports',
  'client_tasks',
  'notes',
  'contacts',
]

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requireRole(supabase, user.id, MANAGER_ROLES)
  if (!auth.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  const orgId = auth.organizationId

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const primaryId = params.id
  const secondaryId: string | undefined = body?.secondary_id
  const propertyChoices: Record<string, 'primary' | 'secondary'> = body?.property_choices || {}

  if (!secondaryId) return NextResponse.json({ error: 'secondary_id is required' }, { status: 400 })
  if (secondaryId === primaryId) {
    return NextResponse.json({ error: 'Cannot merge a record with itself' }, { status: 400 })
  }

  // Verify BOTH clients belong to the caller's org. A missing row also covers
  // the "already deleted / already merged away" case.
  const { data: primary, error: primaryErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', primaryId)
    .eq('organization_id', orgId)
    .single()
  if (primaryErr || !primary) {
    return NextResponse.json({ error: 'Primary client not found' }, { status: 404 })
  }

  const { data: secondary, error: secondaryErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', secondaryId)
    .eq('organization_id', orgId)
    .single()
  if (secondaryErr || !secondary) {
    return NextResponse.json({ error: 'Secondary client not found (it may have been deleted or already merged)' }, { status: 404 })
  }

  if ((primary.merged_client_ids || []).includes(secondaryId)) {
    return NextResponse.json({ error: 'This record has already been merged' }, { status: 409 })
  }

  // Resolve each mergeable property:
  //  - explicit property_choices wins
  //  - otherwise default to primary's value
  //  - if primary's value is null/empty, fall back to secondary's (HubSpot rule)
  const updates: Record<string, any> = {}
  for (const prop of MERGEABLE_PROPS) {
    if (!(prop in primary) && !(prop in secondary)) continue
    const choice = propertyChoices[prop]
    let value: any
    if (choice === 'secondary') value = secondary[prop]
    else if (choice === 'primary') value = primary[prop]
    else value = isEmpty(primary[prop]) ? secondary[prop] : primary[prop]
    if (value !== undefined && value !== primary[prop]) updates[prop] = value
  }

  // Re-point associations from secondary to primary (each table individually,
  // missing tables tolerated)
  for (const table of ASSOCIATION_TABLES) {
    try {
      await supabase.from(table).update({ client_id: primaryId }).eq('client_id', secondaryId)
    } catch {
      // table may not exist in this environment (42P01) — skip
    }
  }
  try {
    await supabase.from('leads').update({ converted_client_id: primaryId }).eq('converted_client_id', secondaryId)
  } catch { /* leads table may not exist */ }
  try {
    // clients can point at each other via related_client_id (migration 010)
    await supabase.from('clients').update({ related_client_id: primaryId }).eq('related_client_id', secondaryId)
  } catch { /* column/table variations tolerated */ }

  // Carry forward the merge lineage: secondary's id plus anything previously
  // merged into it (HubSpot's "Merged record IDs")
  const mergedIds = Array.from(new Set([
    ...(primary.merged_client_ids || []),
    secondaryId,
    ...(secondary.merged_client_ids || []),
  ]))
  updates.merged_client_ids = mergedIds

  const { data: merged, error: updateErr } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', primaryId)
    .eq('organization_id', orgId)
    .select()
    .single()
  if (updateErr) {
    // merged_client_ids column may be missing if migration 025 isn't applied —
    // retry without it so the merge itself still succeeds
    delete updates.merged_client_ids
    const retry = await supabase
      .from('clients')
      .update(updates)
      .eq('id', primaryId)
      .eq('organization_id', orgId)
      .select()
      .single()
    if (retry.error) {
      return NextResponse.json({ error: 'Failed to update primary record' }, { status: 500 })
    }
  }

  // Audit log (best-effort — table may not exist yet)
  try {
    await supabase.from('merge_log').insert({
      organization_id: orgId,
      object_type: 'client',
      primary_id: primaryId,
      secondary_id: secondaryId,
      performed_by: user.id,
      property_choices: propertyChoices,
    })
  } catch { /* merge_log table missing — skip audit */ }

  // Delete the secondary row. This is irreversible.
  const { error: deleteErr } = await supabase
    .from('clients')
    .delete()
    .eq('id', secondaryId)
    .eq('organization_id', orgId)
  if (deleteErr) {
    return NextResponse.json({ error: 'Merged properties but failed to delete the secondary record' }, { status: 500 })
  }

  // Return the merged (surviving) client
  const { data: finalClient } = await supabase
    .from('clients')
    .select('*')
    .eq('id', primaryId)
    .eq('organization_id', orgId)
    .single()

  return NextResponse.json(finalClient || merged || { id: primaryId })
}
