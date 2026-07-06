import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMetricsRefresh } from '@/lib/social/metrics'

// Runs daily (see vercel.json). Refreshes engagement metrics for published
// social posts on a decaying re-poll cadence. Auth via CRON_SECRET.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  try {
    const result = await runMetricsRefresh(supabase, 100)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'metrics refresh failed' }, { status: 500 })
  }
}
