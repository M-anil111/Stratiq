import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listProjects } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../_helpers'

export const dynamic = 'force-dynamic'

function norm(s: string | null | undefined) {
  return (s || '').trim().toLowerCase()
}

// Tolerant select: the proofhub_project_id column comes from migration 044 which
// may not be applied yet. Fall back to selecting without it (missing → null).
async function selectTolerant(
  supabase: any,
  table: string,
  cols: string,
  fallbackCols: string,
  orgId: string
) {
  let { data, error } = await supabase.from(table).select(cols).eq('organization_id', orgId)
  if (error && /proofhub_project_id|column|schema cache/i.test(error.message || '')) {
    const retry = await supabase.from(table).select(fallbackCols).eq('organization_id', orgId)
    data = retry.data
    error = retry.error
  }
  return { data: data || [], error }
}

// GET: list every ProofHub project with any existing Stratiq link (matched by a
// stored proofhub_project_id, or by a case-insensitive name match as a hint).
export async function GET() {
  const { user, res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  const supabase = await createClient()
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user!.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  const orgId = userData.organization_id

  try {
    const phProjects = await listProjects()

    const { data: clients } = await selectTolerant(
      supabase, 'clients',
      'id, company_name, display_name, proofhub_project_id',
      'id, company_name, display_name',
      orgId
    )
    const { data: projects } = await selectTolerant(
      supabase, 'projects',
      'id, name, domain, client_id, proofhub_project_id',
      'id, name, domain, client_id',
      orgId
    )

    const clientById = (id: string) => clients.find((c: any) => String(c.id) === String(id))

    const items = phProjects.map((p) => {
      const idStr = String(p.id)
      const nameKey = norm(p.name)

      const linkedClients = clients
        .filter((c: any) => String(c.proofhub_project_id || '') === idStr)
        .map((c: any) => ({ id: c.id, name: c.display_name || c.company_name, type: 'client' as const, linkedById: true }))
      const linkedProjects = projects
        .filter((pr: any) => String(pr.proofhub_project_id || '') === idStr)
        .map((pr: any) => ({ id: pr.id, name: pr.name || pr.domain, type: 'project' as const, clientId: pr.client_id, linkedById: true }))

      // Name-match hints (only when nothing is linked by id).
      const nameHints =
        linkedClients.length || linkedProjects.length
          ? []
          : clients
              .filter((c: any) => norm(c.display_name) === nameKey || norm(c.company_name) === nameKey)
              .map((c: any) => ({ id: c.id, name: c.display_name || c.company_name, type: 'client' as const, linkedById: false }))

      return {
        proofhubProjectId: p.id,
        name: p.name,
        description: (p.description as string) || '',
        linked: [...linkedClients, ...linkedProjects],
        nameHints,
      }
    })

    // Clients available to link (for the picker).
    const clientOptions = clients.map((c: any) => ({
      id: c.id,
      name: c.display_name || c.company_name,
      proofhubProjectId: c.proofhub_project_id || null,
    }))

    return NextResponse.json({ configured: true, items, clients: clientOptions })
  } catch (e) {
    return phErrorResponse(e)
  }
}

// POST: link/unlink Stratiq records to a ProofHub project. Accepts a single
// { targetType, targetId, proofhubProjectId } or bulk { links: [...] }.
// proofhubProjectId null/'' clears the link. Tolerant of the column missing.
export async function POST(req: NextRequest) {
  const { user, res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  const supabase = await createClient()
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user!.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  const orgId = userData.organization_id

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const links: any[] = Array.isArray(body?.links)
    ? body.links
    : [{ targetType: body?.targetType, targetId: body?.targetId, proofhubProjectId: body?.proofhubProjectId }]

  let columnMissing = false
  let updated = 0
  for (const l of links) {
    const table = l.targetType === 'project' ? 'projects' : 'clients'
    if (!l.targetId) continue
    const value = l.proofhubProjectId ? String(l.proofhubProjectId) : null
    const { error } = await supabase
      .from(table)
      .update({ proofhub_project_id: value })
      .eq('id', l.targetId)
      .eq('organization_id', orgId)
    if (error) {
      if (/proofhub_project_id|column|schema cache/i.test(error.message || '')) {
        columnMissing = true
        break
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    updated++
  }

  if (columnMissing) {
    return NextResponse.json(
      { error: 'The proofhub_project_id column is missing — apply migration 044_proofhub_mapping.sql first.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true, updated })
}
