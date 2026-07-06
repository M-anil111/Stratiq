import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

// HubSpot-style social composer endpoint.
//
// HONEST NOTE: actual publishing to each network turns on only once that
// platform's app credentials are configured in Social Accounts. Until then, this
// endpoint drafts / schedules / stores each post as a `social_media_postings`
// row per selected account so it can be reviewed, scheduled and previewed. No
// outbound network publishing happens here.

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'team_member']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!ALLOWED_ROLES.includes(userData.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = body?.project_id
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

  const accounts: any[] = Array.isArray(body?.accounts) ? body.accounts : []
  if (accounts.length === 0) {
    return NextResponse.json({ error: 'Select at least one account' }, { status: 400 })
  }

  // Verify the project belongs to this org.
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', userData.organization_id)
    .single()
  if (projErr?.code === '42P01') {
    return NextResponse.json({ error: 'The projects table was not found. Run the latest database migrations.' }, { status: 503 })
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const baseCaption = (body?.caption ?? '').toString()
  const perNetwork = (body?.per_network && typeof body.per_network === 'object') ? body.per_network : {}
  const contentType = (body?.content_type ?? 'post').toString()
  const mediaUrl = (body?.media_url ?? '').toString().trim() || null
  const link = (body?.link ?? '').toString().trim() || null
  const campaign = (body?.campaign ?? '').toString().trim()
  const baseFirstComment = (body?.first_comment ?? '').toString().trim()
  const schedule = (body?.schedule && typeof body.schedule === 'object') ? body.schedule : { mode: 'now' }
  const mode = schedule.mode === 'later' ? 'later' : 'now'

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Resolve scheduled_date + status. For "later" we schedule to the provided
  // datetime; if it's in the future the post is 'scheduled'. For "now" we store
  // as 'draft' since we cannot auto-publish without platform credentials.
  let scheduledDate: string | null = today
  let status = 'draft'
  if (mode === 'later' && schedule.datetime) {
    const dt = new Date(schedule.datetime)
    if (!isNaN(dt.getTime())) {
      scheduledDate = dt.toISOString()
      status = dt.getTime() > now.getTime() ? 'scheduled' : 'draft'
    }
  }

  // Map content_type → posting `type` column.
  const typeByContent: Record<string, string> = { post: 'image', story: 'story', reel: 'video' }
  const postType = typeByContent[contentType] || 'image'

  // Build one insert row per selected account.
  const insertRows: Record<string, any>[] = accounts
    .filter((a) => a && a.platform)
    .map((a) => {
      const platform = String(a.platform)
      const override = (perNetwork[platform] && typeof perNetwork[platform] === 'object') ? perNetwork[platform] : {}
      const caption = (override.caption ?? '').toString().trim() || baseCaption
      const firstComment = (override.first_comment ?? '').toString().trim() || baseFirstComment
      // `comment` stores the campaign, falling back to the first comment.
      const comment = campaign || firstComment || null
      return {
        project_id: projectId,
        organization_id: userData.organization_id,
        platform,
        type: postType,
        status,
        live_link: link,
        post_content: caption,
        media_url: mediaUrl,
        scheduled_date: scheduledDate,
        submission_date: today,
        comment,
        created_by: user.id,
      }
    })

  const skipped = accounts.length - insertRows.length
  if (insertRows.length === 0) {
    return NextResponse.json({ created: 0, skipped })
  }

  // Missing-column-tolerant insert (mirrors app/api/clients/route.ts): strip any
  // column PostgREST reports as absent from the schema cache and retry.
  let workingRows = insertRows.map((r) => ({ ...r }))
  let created = 0
  let lastError: any = null
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase.from('social_media_postings').insert(workingRows).select('id')
    if (!error) { created = (data || []).length; lastError = null; break }
    lastError = error
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'The social_media_postings table was not found. Run the latest database migrations.' }, { status: 503 })
    }
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && workingRows[0] && missing in workingRows[0]) {
      workingRows = workingRows.map(({ [missing]: _drop, ...rest }) => rest)
      continue
    }
    break
  }

  if (lastError) {
    return NextResponse.json({ error: lastError.message, created, skipped }, { status: 500 })
  }

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'social_posts_composed',
    entityType: 'social_media_posting',
    entityId: projectId,
    detail: { created, mode, content_type: contentType },
  })

  return NextResponse.json({ created, skipped })
}
