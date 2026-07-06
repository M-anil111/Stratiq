import { NextRequest, NextResponse } from 'next/server'
import { listProjects, createProject, PROOFHUB_CAPS } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()
  try {
    const projects = await listProjects()
    return NextResponse.json({ configured: true, projects })
  } catch (e) {
    return phErrorResponse(e)
  }
}

// POST: create a new ProofHub project. Supported by the v3 API (POST /projects).
export async function POST(req: NextRequest) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()
  if (!PROOFHUB_CAPS.createProject) {
    return NextResponse.json({ error: 'Creating ProofHub projects is not supported' }, { status: 501 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const title = (body?.title || body?.name || '').trim()
  if (!title) return NextResponse.json({ error: 'A project title is required' }, { status: 400 })

  try {
    const project = await createProject({
      title,
      description: body.description ? String(body.description) : undefined,
    })
    return NextResponse.json({ configured: true, project }, { status: 201 })
  } catch (e) {
    return phErrorResponse(e)
  }
}
