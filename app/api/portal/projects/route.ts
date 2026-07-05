import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get client record for this user
  const { data: portalAccess, error: accessError } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (accessError && accessError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to load portal access' }, { status: 500 })
  }

  if (!portalAccess) return NextResponse.json([])

  const { data, error: projectsError } = await supabase
    .from('projects')
    .select('id, domain, status, services, advertising_types, goals')
    .eq('client_id', portalAccess.client_id)
    .order('created_at', { ascending: false })

  if (projectsError) return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })

  return NextResponse.json(data || [])
}
