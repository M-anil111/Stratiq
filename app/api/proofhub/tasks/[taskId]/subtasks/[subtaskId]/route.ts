import { NextRequest, NextResponse } from 'next/server'
import { updateSubtask } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../../../_helpers'

export const dynamic = 'force-dynamic'

// PATCH: complete/incomplete or rename a subtask. body: { projectId, todolistId, completed?, title? }
export async function PATCH(req: NextRequest, { params }: { params: { taskId: string; subtaskId: string } }) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { projectId, todolistId } = body || {}
  if (!projectId || !todolistId) {
    return NextResponse.json({ error: 'projectId and todolistId are required' }, { status: 400 })
  }

  const write: { completed?: boolean; title?: string } = {}
  if (typeof body.completed === 'boolean') write.completed = body.completed
  if (body.title != null) write.title = String(body.title)

  try {
    const subtask = await updateSubtask(projectId, todolistId, params.taskId, params.subtaskId, write)
    return NextResponse.json({ configured: true, subtask })
  } catch (e) {
    return phErrorResponse(e)
  }
}
