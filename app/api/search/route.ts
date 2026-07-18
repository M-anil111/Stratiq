import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { proofhubConfigured, listProjects, listAllTasks } from '@/lib/proofhub'

export type SearchResultItem = {
  id: string
  title: string
  subtitle?: string
  url: string
  type: 'client' | 'contact' | 'project' | 'invoice' | 'lead' | 'task'
}

const ALL_TYPES = ['clients', 'contacts', 'projects', 'invoices', 'leads', 'tasks'] as const
type Category = (typeof ALL_TYPES)[number]

// Escape characters that would break PostgREST .or() filter syntax
function escapeForOr(q: string) {
  return q.replace(/[,()"'\\]/g, ' ').trim()
}

// ProofHub tasks are not in our DB — search them live against the ProofHub
// API. Bounded so a single search keystroke never approaches the 25 req/10s
// rate limit: one call to list projects, one call to /alltodo scoped to a
// capped set of those projects (lib's TTL cache absorbs repeat keystrokes),
// then filter client-side by title and cap the results returned.
const MAX_PROJECTS_FOR_TASK_SEARCH = 10
const MAX_TASK_RESULTS = 6

async function searchProofHubTasks(
  q: string,
  limit: number
): Promise<{ id: string; title: string; subtitle?: string }[]> {
  if (!proofhubConfigured()) return []
  try {
    const projects = await listProjects()
    const scanProjects = projects.slice(0, MAX_PROJECTS_FOR_TASK_SEARCH)
    if (scanProjects.length === 0) return []

    const tasks = await listAllTasks({
      projects: scanProjects.map(p => p.id),
      limit: 100,
    })

    const needle = q.toLowerCase()
    const projectNameById = new Map(scanProjects.map(p => [p.id, p.name]))
    const matches = tasks.filter(t => (t.title || '').toLowerCase().includes(needle))

    return matches.slice(0, Math.min(limit, MAX_TASK_RESULTS)).map(t => ({
      id: String(t.id),
      title: t.title,
      subtitle: t.project?.name || (t.project?.id != null ? projectNameById.get(t.project.id) : undefined),
    }))
  } catch {
    // ProofHub down/misconfigured/rate-limited — degrade to no task results.
    return []
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  // ?types=clients,invoices — filter which categories run
  const typesParam = req.nextUrl.searchParams.get('types')
  const requested: Category[] = typesParam
    ? (typesParam.split(',').map(t => t.trim()).filter(t => (ALL_TYPES as readonly string[]).includes(t)) as Category[])
    : [...ALL_TYPES]
  const types = requested.length > 0 ? requested : [...ALL_TYPES]

  // ?limit= per category (default 5, max 20)
  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '5', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 5, 1), 20)

  const orgId = userData.organization_id
  const safe = escapeForOr(q)
  const pattern = `%${safe}%`

  // Wrap each query so a missing table (42P01) or any other error degrades to []
  async function safeQuery<T>(fn: () => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    try {
      const { data, error } = await fn()
      if (error) return []
      return data || []
    } catch {
      return []
    }
  }

  const [clients, contacts, projects, invoices, leads, tasks] = await Promise.all([
    types.includes('clients')
      ? safeQuery<{ id: string; company_name: string; email: string | null; phone: string | null; project_status: string | null }>(() =>
          supabase
            .from('clients')
            .select('id, company_name, email, phone, project_status')
            .eq('organization_id', orgId)
            .or(`company_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
            .limit(limit)
        )
      : Promise.resolve([]),
    types.includes('contacts')
      ? safeQuery<{ id: string; name: string | null; email: string | null; phone: string | null }>(() =>
          supabase
            .from('contacts')
            .select('id, name, email, phone')
            .eq('organization_id', orgId)
            .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
            .limit(limit)
        )
      : Promise.resolve([]),
    types.includes('projects')
      ? safeQuery<{ id: string; name: string; client_id: string; clients: { company_name?: string } | { company_name?: string }[] | null }>(() =>
          supabase
            .from('projects')
            .select('id, name, client_id, clients(company_name)')
            .eq('organization_id', orgId)
            .ilike('name', pattern)
            .limit(limit)
        )
      : Promise.resolve([]),
    types.includes('invoices')
      ? safeQuery<{ id: string; invoice_number: string | null; amount: number | null; status: string | null; client_id: string | null; clients: { company_name?: string } | { company_name?: string }[] | null }>(() =>
          supabase
            .from('invoices')
            .select('id, invoice_number, amount, status, client_id, clients(company_name)')
            .eq('organization_id', orgId)
            .or(`invoice_number.ilike.${pattern},status.ilike.${pattern}`)
            .limit(limit)
        )
      : Promise.resolve([]),
    types.includes('leads')
      ? safeQuery<{ id: string; company_name: string; contact_name: string | null; email: string | null; stage: string | null }>(() =>
          supabase
            .from('leads')
            .select('id, company_name, contact_name, email, stage')
            .eq('organization_id', orgId)
            .or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`)
            .limit(limit)
        )
      : Promise.resolve([]),
    types.includes('tasks')
      ? searchProofHubTasks(safe, limit)
      : Promise.resolve([]),
  ])

  function joinedName(rel: { company_name?: string } | { company_name?: string }[] | null): string | undefined {
    if (!rel) return undefined
    if (Array.isArray(rel)) return rel[0]?.company_name
    return rel.company_name
  }

  const results: SearchResultItem[] = [
    ...clients.map(c => ({
      type: 'client' as const,
      id: c.id,
      title: c.company_name,
      subtitle: [c.email, c.project_status].filter(Boolean).join(' · ') || undefined,
      url: `/clients/${c.id}`,
    })),
    ...contacts.map(c => ({
      type: 'contact' as const,
      id: c.id,
      title: c.name || c.email || 'Contact',
      subtitle: [c.email, c.phone].filter(Boolean).join(' · ') || undefined,
      url: `/contacts`,
    })),
    ...projects.map(p => ({
      type: 'project' as const,
      id: p.id,
      title: p.name,
      subtitle: joinedName(p.clients),
      url: `/clients/${p.client_id}`,
    })),
    ...invoices.map(i => ({
      type: 'invoice' as const,
      id: i.id,
      title: i.invoice_number || `Invoice #${i.id.slice(0, 8)}`,
      subtitle: [joinedName(i.clients), i.status].filter(Boolean).join(' · ') || undefined,
      url: `/invoices`,
    })),
    ...leads.map(l => ({
      type: 'lead' as const,
      id: l.id,
      title: l.company_name,
      subtitle: [l.contact_name, l.email, l.stage].filter(Boolean).join(' · ') || undefined,
      url: `/leads`,
    })),
    ...tasks.map(t => ({
      type: 'task' as const,
      id: t.id,
      title: t.title,
      subtitle: t.subtitle,
      url: '/tasks',
    })),
  ]

  // Per-category counts so the client can decide whether "See more" applies
  const counts: Record<string, number> = {
    clients: clients.length,
    contacts: contacts.length,
    projects: projects.length,
    invoices: invoices.length,
    leads: leads.length,
    tasks: tasks.length,
  }

  return NextResponse.json({ results, counts, limit })
}
