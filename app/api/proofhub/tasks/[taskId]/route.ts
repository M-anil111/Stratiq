import { NextRequest, NextResponse } from 'next/server'
import {
  getTask,
  updateTask,
  moveTaskStage,
  listSubtasks,
  TaskWriteBody,
} from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../_helpers'

export const dynamic = 'force-dynamic'

// GET: fetch a single task (+ subtasks). Requires projectId & todolistId query params.
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
    const task = await getTask(projectId, todolistId, params.taskId)
    let subtasks: unknown[] = []
    try {
      subtasks = await listSubtasks(projectId, todolistId, params.taskId)
    } catch {
      subtasks = Array.isArray(task.sub_tasks) ? task.sub_tasks : []
    }
    return NextResponse.json({ configured: true, task, subtasks })
  } catch (e) {
    return phErrorResponse(e)
  }
}

// PATCH: update a task. body: { projectId, todolistId, ...fields }
// Supported: complete, stage, assignedIds, due_date, start_date, title,
// description, labels, estimated_hours, estimated_mins.
export async function PATCH(req: NextRequest, { params }: { params: { taskId: string } }) {
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

  try {
    // Move stage is its own PUT shape.
    if (body.stage != null && body.moveStage) {
      const task = await moveTaskStage(projectId, todolistId, params.taskId, Number(body.stage))
      return NextResponse.json({ configured: true, task })
    }

    const write: TaskWriteBody = {}
    if (typeof body.complete === 'boolean') write.completed = body.complete
    if (typeof body.completed === 'boolean') write.completed = body.completed
    if (body.title != null) write.title = String(body.title)
    if (body.description != null) write.description = String(body.description)
    if (body.due_date !== undefined) write.due_date = body.due_date || ''
    if (body.start_date !== undefined) write.start_date = body.start_date || ''
    if (Array.isArray(body.assignedIds)) {
      write.assigned = body.assignedIds.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
    }
    if (Array.isArray(body.labels)) {
      write.labels = body.labels.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
    }
    if (body.estimated_hours != null) write.estimated_hours = Number(body.estimated_hours)
    if (body.estimated_mins != null) write.estimated_mins = Number(body.estimated_mins)
    if (body.stage != null) write.stage = Number(body.stage)

    const task = await updateTask(projectId, todolistId, params.taskId, write)
    return NextResponse.json({ configured: true, task })
  } catch (e) {
    return phErrorResponse(e)
  }
}
