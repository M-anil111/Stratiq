import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) {
    return NextResponse.json({ active_projects: 0, files_count: 0, unread_messages: 0 })
  }

  const clientId = portalAccess.client_id

  const [projectsResult, filesResult, messagesResult] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'active'),
    supabase
      .from('google_drive_files')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_read', false)
      .neq('sender_type', 'client'),
  ])

  return NextResponse.json({
    active_projects: projectsResult.count ?? 0,
    files_count: filesResult.count ?? 0,
    unread_messages: messagesResult.count ?? 0,
  })
}
