import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'

// HubSpot-style contact merge against the standalone `contacts` table
// (migration 025). The primary record survives, the secondary is deleted.
// NOTE: merges are NOT reversible (HubSpot behavior).

const MERGEABLE_PROPS = ['name', 'email', 'phone', 'client_id'] as const

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  return false
}

function isMissingTable(error: any): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '')
}

// GET /api/contacts/merge?q=... — search merge candidates in the contacts table
// GET /api/contacts/merge?id=... — fetch one contact record (used by MergeModal
// to build the side-by-side comparison)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  if (id) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', userData.organization_id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  const q = request.nextUrl.searchParams.get('q') || ''
  let query = supabase
    .from('contacts')
    .select('id, name, email, phone, client_id')
    .eq('organization_id', userData.organization_id)
    .order('name')
    .limit(10)
  if (q) {
    const safe = q.replace(/[,()"'\\]/g, ' ').trim()
    if (safe) query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ contacts: [] }) // 42P01 etc. degrade to empty
  return NextResponse.json({ contacts: data || [] })
}

export async function POST(request: NextRequest) {
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

  const primaryId: string | undefined = body?.primary_id
  const secondaryId: string | undefined = body?.secondary_id
  const propertyChoices: Record<string, 'primary' | 'secondary'> = body?.property_choices || {}

  if (!primaryId || !secondaryId) {
    return NextResponse.json({ error: 'primary_id and secondary_id are required' }, { status: 400 })
  }
  if (primaryId === secondaryId) {
    return NextResponse.json({ error: 'Cannot merge a record with itself' }, { status: 400 })
  }

  // Verify BOTH contacts belong to the caller's org; a missing row also covers
  // the "already deleted / already merged away" case.
  const { data: primary, error: primaryErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .eq('organization_id', orgId)
    .single()
  if (primaryErr || !primary) {
    if (isMissingTable(primaryErr)) {
      return NextResponse.json({ error: 'Contacts are not available yet' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Primary contact not found' }, { status: 404 })
  }

  const { data: secondary, error: secondaryErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', secondaryId)
    .eq('organization_id', orgId)
    .single()
  if (secondaryErr || !secondary) {
    return NextResponse.json({ error: 'Secondary contact not found (it may have been deleted or already merged)' }, { status: 404 })
  }

  if ((primary.merged_contact_ids || []).includes(secondaryId)) {
    return NextResponse.json({ error: 'This record has already been merged' }, { status: 409 })
  }

  // Property resolution: explicit choice > primary's value > secondary's value
  // when primary's is empty (HubSpot rule)
  const updates: Record<string, any> = {}
  for (const prop of MERGEABLE_PROPS) {
    const choice = propertyChoices[prop]
    let value: any
    if (choice === 'secondary') value = secondary[prop]
    else if (choice === 'primary') value = primary[prop]
    else value = isEmpty(primary[prop]) ? secondary[prop] : primary[prop]
    if (value !== undefined && value !== primary[prop]) updates[prop] = value
  }

  // Contacts have no dependent association tables (only their own client_id
  // pointer, handled above as a mergeable property).

  updates.merged_contact_ids = Array.from(new Set([
    ...(primary.merged_contact_ids || []),
    secondaryId,
    ...(secondary.merged_contact_ids || []),
  ]))

  const { error: updateErr } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', primaryId)
    .eq('organization_id', orgId)
  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update primary record' }, { status: 500 })
  }

  // Audit log (best-effort — table may not exist yet)
  try {
    await supabase.from('merge_log').insert({
      organization_id: orgId,
      object_type: 'contact',
      primary_id: primaryId,
      secondary_id: secondaryId,
      performed_by: user.id,
      property_choices: propertyChoices,
    })
  } catch { /* merge_log table missing — skip audit */ }

  // Delete the secondary row. This is irreversible.
  const { error: deleteErr } = await supabase
    .from('contacts')
    .delete()
    .eq('id', secondaryId)
    .eq('organization_id', orgId)
  if (deleteErr) {
    return NextResponse.json({ error: 'Merged properties but failed to delete the secondary record' }, { status: 500 })
  }

  const { data: finalContact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .eq('organization_id', orgId)
    .single()

  return NextResponse.json(finalContact || { id: primaryId })
}
