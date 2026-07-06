import { NextResponse } from 'next/server'
import { listTodolists, listTasks, harvestStages, PHTask, PHStage } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../../_helpers'

export const dynamic = 'force-dynamic'

// Cap the number of todolists scanned per board load to stay rate-limit safe.
const MAX_TODOLISTS = 15

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()

  const { projectId } = params
  try {
    const todolists = await listTodolists(projectId)
    const scan = todolists.slice(0, MAX_TODOLISTS)
    const partial = todolists.length > scan.length

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

    // Derive kanban stages from all harvested tasks across lists.
    const allTasks = lists.flatMap((l) => l.tasks)
    const stages: PHStage[] = harvestStages(allTasks)

    return NextResponse.json({
      configured: true,
      projectId: Number(projectId),
      lists,
      stages,
      partial,
    })
  } catch (e) {
    return phErrorResponse(e)
  }
}
