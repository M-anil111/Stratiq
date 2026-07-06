import { NextRequest, NextResponse } from 'next/server'
import {
  listTodolists, listTasks, listAllTasks, harvestStages, harvestWorkflows,
  PHTask, PHStage,
} from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../../_helpers'

export const dynamic = 'force-dynamic'

// Cap the number of todolists scanned per board load to stay rate-limit safe.
const MAX_TODOLISTS = 15

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  const { projectId } = params
  const includeCompleted = req.nextUrl.searchParams.get('completed') === '1'
  try {
    const todolists = await listTodolists(projectId)
    const scan = todolists.slice(0, MAX_TODOLISTS)
    let partial = todolists.length > scan.length

    const lists = await Promise.all(
      scan.map(async (tl) => {
        let tasks: PHTask[] = []
        try {
          tasks = await listTasks(projectId, tl.id)
        } catch {
          tasks = []
        }
        return {
          id: tl.id,
          name: tl.title || tl.name || `List ${tl.id}`,
          tasks,
        }
      })
    )

    const openTasks = lists.flatMap((l) => l.tasks)

    // Historical/completed tasks: a single /alltodo call scoped to this project
    // (completed=true returns completed + open; we keep only the completed ones
    // not already present in the open lists). Rate-limit safe (+1 request).
    let completedTasks: PHTask[] = []
    if (includeCompleted) {
      try {
        const all = await listAllTasks({ projects: [projectId], completed: true, limit: 100 })
        const openIds = new Set(openTasks.map((t) => t.id))
        completedTasks = all.filter((t) => t.completed && !openIds.has(t.id))
      } catch {
        // best-effort — don't fail the board if alltodo is unavailable
        partial = true
      }
    }

    const allTasks = [...openTasks, ...completedTasks]
    const stages: PHStage[] = harvestStages(allTasks)
    const workflows: PHStage[] = harvestWorkflows(allTasks)

    return NextResponse.json({
      configured: true,
      projectId: Number(projectId),
      lists,
      stages,
      workflows,
      completedTasks,
      includeCompleted,
      partial,
    })
  } catch (e) {
    return phErrorResponse(e)
  }
}
