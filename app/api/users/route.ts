import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('organization_id', userData.organization_id)
    .in('role', ['super_admin', 'admin', 'manager', 'team_member'])
    .order('full_name')

  return NextResponse.json(data || [])
}
