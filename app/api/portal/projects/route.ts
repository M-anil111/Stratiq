import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get client record for this user
  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const { data } = await supabase
    .from('projects')
    .select('id, domain, status, services, advertising_types, goals')
    .eq('client_id', portalAccess.client_id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}
