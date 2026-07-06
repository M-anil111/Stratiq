import { NextRequest, NextResponse } from 'next/server'
import { createTask, resolvePeopleByEmail, TaskWriteBody } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../_helpers'

export const dynamic = 'force-dynamic'

// POST: create a task in ProofHub.
// body: { projectId, todolistId, title, description?, due_date?,
//         assigneeEmails?[], assignedIds?[], labels?[] }
export async function POST(req: NextRequest) {
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
  if (!projectId || !todolistId || !title) {
    return NextResponse.json(
      { error: 'projectId, todolistId and title are required' },
      { status: 400 }
    )
  }

  try {
    let assigned: number[] = Array.isArray(body.assignedIds)
      ? body.assignedIds.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
      : []

    if (Array.isArray(body.assigneeEmails) && body.assigneeEmails.length) {
      const map = await resolvePeopleByEmail(body.assigneeEmails)
      const merged = assigned.concat(Object.values(map))
      assigned = merged.filter((v, i) => merged.indexOf(v) === i)
    }

    const write: TaskWriteBody = {
      title: String(title),
    }
    if (body.description) write.description = String(body.description)
    if (body.due_date) write.due_date = String(body.due_date)
    if (body.start_date) write.start_date = String(body.start_date)
    if (assigned.length) write.assigned = assigned
    if (Array.isArray(body.labels) && body.labels.length) {
      write.labels = body.labels.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
    }

    const task = await createTask(projectId, todolistId, write)
    return NextResponse.json({ configured: true, task })
  } catch (e) {
    return phErrorResponse(e)
  }
}
