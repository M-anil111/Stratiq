import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { email, full_name, role } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // Use service role for auth admin operations
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Send auth invite
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      organization_id: userData.organization_id,
      role: role || 'team_member',
      full_name: full_name || '',
    },
  })

  if (inviteError && !inviteError.message.includes('already been registered')) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  // Upsert into users table
  const { data: member, error: upsertError } = await supabase
    .from('users')
    .upsert({
      email,
      full_name: full_name || '',
      role: role || 'team_member',
      organization_id: userData.organization_id,
      status: 'invited',
      created_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select()
    .single()

  if (upsertError) {
    // If upsert fails, try insert
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        full_name: full_name || '',
        role: role || 'team_member',
        organization_id: userData.organization_id,
        status: 'invited',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    return NextResponse.json({ success: true, member: inserted }, { status: 201 })
  }

  return NextResponse.json({ success: true, member }, { status: 201 })
}
