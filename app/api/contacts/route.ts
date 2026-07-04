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
    .select('id, company_name, contact_first_name, contact_last_name, project_status, service_packages, display_name')
    .eq('organization_id', userData.organization_id)
    .order('contact_first_name')

  if (q) {
    query = query.or(
      `contact_first_name.ilike.%${q}%,contact_last_name.ilike.%${q}%,company_name.ilike.%${q}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json([], { status: 200 })

  // Group by contact person (first + last name)
  const contactMap = new Map<string, { contact_first_name: string; contact_last_name: string; businesses: any[] }>()
  for (const row of data || []) {
    const key = `${row.contact_first_name || ''}|${row.contact_last_name || ''}`
    if (!contactMap.has(key)) {
      contactMap.set(key, {
        contact_first_name: row.contact_first_name || '',
        contact_last_name: row.contact_last_name || '',
        businesses: [],
      })
    }
    contactMap.get(key)!.businesses.push({
      id: row.id,
      company_name: row.company_name,
      display_name: row.display_name,
      project_status: row.project_status,
      mrr: (row.service_packages || []).reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0),
    })
  }

  return NextResponse.json(Array.from(contactMap.values()))
}
