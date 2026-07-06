import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Business = {
  id: string
  company_name: string
  display_name: string
  project_status: string
  mrr: number
}

type Contact = {
  contact_first_name: string
  contact_last_name: string
  businesses: Business[]
}

function mrrOf(service_packages: any): number {
  return (Array.isArray(service_packages) ? service_packages : [])
    .reduce((s: number, p: any) => s + (parseFloat(p?.price) || 0), 0)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json([], { status: 200 })

  const q = (request.nextUrl.searchParams.get('q') || '').trim()

  // Pull clients. Prefer the real contact-person columns (migration 010); fall
  // back to a leaner select if those columns don't exist on the live DB yet.
  const clientSelects = [
    'id, company_name, project_status, service_packages, contact_first_name, contact_last_name',
    'id, company_name, project_status, service_packages',
  ]
  let clients: any[] = []
  for (const sel of clientSelects) {
    let query = supabase
      .from('clients')
      .select(sel)
      .eq('organization_id', userData.organization_id)
      .order('company_name')
    if (q) query = query.ilike('company_name', `%${q}%`)
    const { data, error } = await query
    if (!error) { clients = data || []; break }
    if (error.code !== '42703') { clients = []; break }
  }

  // Build a business record per client and derive the contact name from the
  // real contact columns, only falling back to the company name when unset.
  const byName = new Map<string, Contact>()
  const bizIndex = new Map<string, Business>()

  const addBusiness = (first: string, last: string, biz: Business) => {
    const key = `${first.toLowerCase()}|${last.toLowerCase()}`
    const existing = byName.get(key)
    if (existing) existing.businesses.push(biz)
    else byName.set(key, { contact_first_name: first, contact_last_name: last, businesses: [biz] })
  }

  for (const row of clients) {
    let first = (row.contact_first_name || '').trim()
    let last = (row.contact_last_name || '').trim()
    if (!first && !last) {
      const parts = (row.company_name || '').trim().split(/\s+/)
      first = parts[0] || row.company_name || ''
      last = parts.slice(1).join(' ')
    }
    const biz: Business = {
      id: row.id,
      company_name: row.company_name,
      display_name: row.company_name,
      project_status: row.project_status,
      mrr: mrrOf(row.service_packages),
    }
    bizIndex.set(row.id, biz)
    addBusiness(first, last, biz)
  }

  // Fold in the standalone `contacts` table (real people linked to a client).
  // Tolerate the table not existing yet (42P01).
  {
    let cq = supabase
      .from('contacts')
      .select('id, name, client_id')
      .eq('organization_id', userData.organization_id)
    if (q) cq = cq.ilike('name', `%${q}%`)
    const { data: people, error } = await cq
    if (!error && people) {
      for (const person of people) {
        const parts = (person.name || '').trim().split(/\s+/)
        const first = parts[0] || ''
        const last = parts.slice(1).join(' ')
        if (!first && !last) continue
        // Link to the client they belong to, if that client is loaded.
        const biz = person.client_id ? bizIndex.get(person.client_id) : undefined
        const key = `${first.toLowerCase()}|${last.toLowerCase()}`
        if (byName.has(key)) continue // already represented via the client grouping
        byName.set(key, {
          contact_first_name: first,
          contact_last_name: last,
          businesses: biz ? [biz] : [],
        })
      }
    }
  }

  const contacts = Array.from(byName.values())
    .sort((a, b) => (a.contact_first_name + a.contact_last_name)
      .localeCompare(b.contact_first_name + b.contact_last_name))

  return NextResponse.json(contacts)
}
