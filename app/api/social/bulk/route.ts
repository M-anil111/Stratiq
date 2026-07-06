import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// Bulk scheduler (Hootsuite-style CSV import). Accepts many parsed rows and
// creates one scheduled social_media_postings per (row × platform).
//
// body: { project_id, rows: [{ date:'YYYY-MM-DD', time:'HH:MM', platforms:[],
//         caption, media_url?, link? }] }

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'team_member']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!ALLOWED_ROLES.includes(userData.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const projectId = body?.project_id
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ error: 'No rows to schedule' }, { status: 400 })
  if (rows.length > 350) return NextResponse.json({ error: 'Bulk upload is limited to 350 posts at a time.' }, { status: 400 })

  const { data: project, error: projErr } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('organization_id', userData.organization_id).single()
  if (projErr?.code === '42P01') return NextResponse.json({ error: 'The projects table was not found. Run the latest database migrations.' }, { status: 503 })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const errors: string[] = []
  const insertRows: Record<string, any>[] = []

  rows.forEach((r, i) => {
    const date = String(r.date || '').trim()
    const time = String(r.time || '00:00').trim()
    const platforms: string[] = Array.isArray(r.platforms)
      ? r.platforms
      : String(r.platform || '').split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean)
    const caption = String(r.caption || '').trim()
    if (!date) { errors.push(`Row ${i + 1}: missing date`); return }
    if (platforms.length === 0) { errors.push(`Row ${i + 1}: no platform`); return }
    const dt = new Date(`${date}T${time}`)
    if (isNaN(dt.getTime())) { errors.push(`Row ${i + 1}: invalid date/time`); return }
    const scheduledDate = dt.toISOString()
    for (const platform of platforms) {
      insertRows.push({
        project_id: projectId,
        organization_id: userData.organization_id,
        platform,
        type: 'image',
        content_type: 'post',
        status: 'scheduled',
        post_content: caption,
        media_url: (r.media_url || '').toString().trim() || null,
        link: (r.link || '').toString().trim() || null,
        live_link: (r.link || '').toString().trim() || null,
        scheduled_date: scheduledDate,
        submission_date: today,
        created_by: user.id,
      })
    }
  })

  if (insertRows.length === 0) {
    return NextResponse.json({ created: 0, errors }, { status: 400 })
  }

  // Missing-column-tolerant insert (mirrors the composer).
  let working = insertRows.map((r) => ({ ...r }))
  let created = 0
  let lastError: any = null
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase.from('social_media_postings').insert(working).select('id')
    if (!error) { created = (data || []).length; lastError = null; break }
    lastError = error
    if (error.code === '42P01') return NextResponse.json({ error: 'The social_media_postings table was not found. Run the latest database migrations.' }, { status: 503 })
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && working[0] && missing in working[0]) {
      working = working.map(({ [missing]: _drop, ...rest }) => rest)
      continue
    }
    break
  }

  if (lastError) return NextResponse.json({ error: lastError.message, created, errors }, { status: 500 })

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'social_posts_bulk_scheduled',
    entityType: 'social_media_posting',
    entityId: projectId,
    detail: { created, rows: rows.length },
  })

  return NextResponse.json({ created, errors })
}
