import type { SupabaseClient } from '@supabase/supabase-js'

// If `value` doesn't already exist as an approved Masters entry for this
// org+category, insert it as one — auto-approved (the value is already in
// real use on a real record, not speculative admin input). Lets a user type
// a brand-new Industry/etc. once on a client/project form and have it show
// up as a real option everywhere else going forward, instead of vanishing
// into a disconnected free-text field. Best-effort: never throws, so a
// Masters hiccup can never block the client/project save it's attached to.
export async function autoCreateMasterIfMissing(
  supabase: SupabaseClient,
  organizationId: string,
  category: string,
  value: string | null | undefined,
  userId: string
): Promise<void> {
  const trimmed = (value || '').trim()
  if (!trimmed) return

  try {
    const { data: existing, error: selectError } = await supabase
      .from('masters')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('category', category)
      .ilike('value', trimmed)
      .limit(1)

    if (selectError) return // table missing or other issue — degrade silently
    if (existing && existing.length > 0) return

    await supabase.from('masters').insert({
      organization_id: organizationId,
      category,
      value: trimmed,
      label: trimmed,
      is_active: true,
      approval_status: 'approved',
      created_by: userId,
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
  } catch {
    // non-fatal
  }
}
