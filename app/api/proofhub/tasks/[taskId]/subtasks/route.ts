import { NextRequest, NextResponse } from 'next/server'
import { createSubtask, SubtaskWriteBody } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../../_helpers'

export const dynamic = 'force-dynamic'

// POST: create a subtask on a task. body: { projectId, todolistId, title, ... }
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

  const { projectId, todolistId, title } = body || {}
  if (!projectId || !todolistId) {
    return NextResponse.json({ error: 'projectId and todolistId are required' }, { status: 400 })
  }
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
  }

  const write: SubtaskWriteBody = { title: String(title).trim() }
  if (body.description != null) write.description = String(body.description)
  if (body.due_date) write.due_date = body.due_date
  if (body.start_date) write.start_date = body.start_date
  if (Array.isArray(body.assignedIds)) {
    write.assigned = body.assignedIds.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
  }

  try {
    const subtask = await createSubtask(projectId, todolistId, params.taskId, write)
    return NextResponse.json({ configured: true, subtask })
  } catch (e) {
    return phErrorResponse(e)
  }
}
