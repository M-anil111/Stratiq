import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDuePublishes } from '@/lib/social/publish'

// Runs frequently (see vercel.json */5). Publishes every scheduled social post
// whose time has arrived, across all orgs. Auth via CRON_SECRET. Can also be
// hit manually by an admin dry-run trigger.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  try {
    const result = await runDuePublishes(supabase)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'publish run failed' }, { status: 500 })
  }
}
