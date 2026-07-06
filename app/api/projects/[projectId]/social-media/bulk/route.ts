import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_ROWS = 300

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // Verify the project belongs to this organization.
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', params.projectId)
    .eq('organization_id', userData.organization_id)
    .single()
  if (projErr) {
    if (projErr.code === '42P01') {
      return NextResponse.json({ error: 'The projects table was not found. Run the latest database migrations.' }, { status: 503 })
    }
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : []

  const errors: string[] = []
  let skipped = 0

  const today = new Date().toISOString().split('T')[0]

  // Build insert rows, skipping invalid rows (no message).
  const insertRows: Record<string, any>[] = []
  for (let i = 0; i < rows.length && insertRows.length < MAX_ROWS; i++) {
    const r = rows[i] || {}
    const message = (r.post_content ?? r.message ?? '').toString().trim()
    if (!message) { skipped++; continue }

    const platform = (r.platform ?? '').toString().trim()
    const campaign = (r.campaign ?? '').toString().trim()

    insertRows.push({
      project_id: params.projectId,
      organization_id: userData.organization_id,
      platform: platform || 'Facebook Post',
      type: 'image',
      status: (r.status ?? '').toString().trim() || 'scheduled',
      live_link: (r.link ?? '').toString().trim() || null,
      post_content: message,
      media_url: (r.media_url ?? '').toString().trim() || null,
      scheduled_date: (r.scheduled_date ?? '').toString().trim() || null,
      submission_date: today,
      comment: campaign || null,
      created_by: user.id,
    })
  }

  if (rows.length > MAX_ROWS) {
    errors.push(`Only the first ${MAX_ROWS} rows were processed; ${rows.length - MAX_ROWS} additional rows were ignored.`)
  }

  if (insertRows.length === 0) {
    return NextResponse.json({ created: 0, skipped, errors })
  }

  // Missing-column-tolerant insert: strip any column PostgREST reports as
  // missing from the schema cache and retry (mirrors app/api/clients/route.ts).
  let workingRows = insertRows.map(r => ({ ...r }))
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
    return NextResponse.json({ error: lastError.message, created, skipped, errors }, { status: 500 })
  }

  return NextResponse.json({ created, skipped, errors })
}
