import { NextRequest, NextResponse } from 'next/server'
import { listComments, addComment } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../../_helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  const projectId = req.nextUrl.searchParams.get('projectId')
  const todolistId = req.nextUrl.searchParams.get('todolistId')
  if (!projectId || !todolistId) {
    return NextResponse.json({ error: 'projectId and todolistId query params are required' }, { status: 400 })
  }
  try {
    const comments = await listComments(projectId, todolistId, params.taskId)
    return NextResponse.json({ configured: true, comments })
  } catch (e) {
    return phErrorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { projectId, todolistId, content } = body || {}
  if (!projectId || !todolistId || !content) {
    return NextResponse.json({ error: 'projectId, todolistId and content are required' }, { status: 400 })
  }
  try {
    const comment = await addComment(projectId, todolistId, params.taskId, String(content))
    return NextResponse.json({ configured: true, comment })
  } catch (e) {
    return phErrorResponse(e)
  }
}
