import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOrgClient(supabase: any, userId: string) {
  const { data } = await supabase.from('users').select('organization_id, role').eq('id', userId).single()
  return data
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userData = await getOrgClient(supabase, user.id)
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = searchParams.get('month') || defaultMonth

  // Verify client belongs to org
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('marketing_reports')
    .select('*')
    .eq('client_id', params.id)
    .eq('organization_id', userData.organization_id)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
