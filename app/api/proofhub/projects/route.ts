import { NextResponse } from 'next/server'
import { listProjects } from '@/lib/proofhub'
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
