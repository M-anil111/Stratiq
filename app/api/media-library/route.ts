import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Reusable media library. Rows are metadata + a Google Drive reference; the
// binary lives in Drive. Tolerant of the media_assets table not existing yet.

async function orgOf(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, organizationId: null }
  const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  return { user, organizationId: data?.organization_id || null }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { user, organizationId } = await orgOf(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const kind = req.nextUrl.searchParams.get('kind')
  let q = supabase
    .from('media_assets')
    .select('id, drive_file_id, name, url, mime_type, kind, bytes, width, height, folder, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (kind) q = q.eq('kind', kind)

  const { data, error } = await q
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { user, organizationId } = await orgOf(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.url && !body.drive_file_id) {
    return NextResponse.json({ error: 'url or drive_file_id is required' }, { status: 400 })
  }

  const row = {
    organization_id: organizationId,
    drive_file_id: body.drive_file_id || null,
    name: body.name || null,
    url: body.url || null,
    mime_type: body.mime_type || null,
    kind: body.kind || (String(body.mime_type || '').startsWith('video') ? 'video' : 'image'),
    bytes: body.bytes || null,
    width: body.width || null,
    height: body.height || null,
    folder: body.folder || null,
    created_by: user.id,
  }
  const { data, error } = await supabase.from('media_assets').insert(row).select().single()
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Media library table not set up yet. Run the latest database migrations.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { user, organizationId } = await orgOf(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('media_assets').delete().eq('id', id).eq('organization_id', organizationId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
