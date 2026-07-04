import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json([], { status: 200 })

  const q = request.nextUrl.searchParams.get('q') || ''

  let query = supabase
    .from('clients')
    .select('id, company_name, project_status, service_packages')
    .eq('organization_id', userData.organization_id)
    .order('company_name')

  if (q) {
    query = query.ilike('company_name', `%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json([], { status: 200 })

  // Return each client as a "contact" entry using company_name parts as first/last
  const contacts = (data || []).map(row => {
    const parts = (row.company_name || '').trim().split(/\s+/)
    return {
      contact_first_name: parts[0] || row.company_name || '',
      contact_last_name: parts.slice(1).join(' ') || '',
      businesses: [{
        id: row.id,
        company_name: row.company_name,
        display_name: row.company_name,
        project_status: row.project_status,
        mrr: (row.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0),
      }],
    }
  })

  return NextResponse.json(contacts)
}
