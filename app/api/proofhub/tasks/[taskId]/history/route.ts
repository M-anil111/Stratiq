import { NextRequest, NextResponse } from 'next/server'
import { getTaskHistory, PROOFHUB_CAPS } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../../../_helpers'

export const dynamic = 'force-dynamic'

// GET: per-task activity log (task_history). Requires projectId & todolistId.
export async function GET(req: NextRequest, { params }: { params: { taskId: string } }) {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()
  if (!PROOFHUB_CAPS.taskHistory) {
    return NextResponse.json({ configured: true, activities: [], supported: false })
  }

  const projectId = req.nextUrl.searchParams.get('projectId')
  const todolistId = req.nextUrl.searchParams.get('todolistId')
  if (!projectId || !todolistId) {
    return NextResponse.json({ error: 'projectId and todolistId query params are required' }, { status: 400 })
  }

  try {
    const activities = await getTaskHistory(projectId, todolistId, params.taskId)
    return NextResponse.json({ configured: true, supported: true, activities })
  } catch (e) {
    return phErrorResponse(e)
  }
}
