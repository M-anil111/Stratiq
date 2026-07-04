import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(organization_id)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const { data } = await supabase
    .from('marketing_reports')
    .select('id, period_start, period_end, report_type, status, created_at')
    .eq('client_id', portalAccess.client_id)
    .order('period_start', { ascending: false })

  return NextResponse.json(data || [])
}
