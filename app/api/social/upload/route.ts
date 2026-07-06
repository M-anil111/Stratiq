import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFile, createClientFolder } from '@/lib/google-drive'

// Hard server-side size cap regardless of client-side compression.
const MAX_BYTES = 100 * 1024 * 1024 // 100MB

// Uploads a composer media file to the selected client's Google Drive folder and
// returns { url, file_id }. Files always go to Drive (never Vercel/Supabase storage).
// Accepts multipart/form-data (field `file` + `client_id`) or JSON with base64
// ({ client_id, filename, mime_type, data_base64 }).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!userData?.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 403 })
  }

  let clientId = ''
  let filename = 'upload'
  let mimeType = 'application/octet-stream'
  let buffer: Buffer

  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const body = await req.json()
      clientId = body.client_id || ''
      filename = body.filename || filename
      mimeType = body.mime_type || mimeType
      const b64 = (body.data_base64 || '').replace(/^data:[^;]+;base64,/, '')
      if (!b64) return NextResponse.json({ error: 'No file data provided' }, { status: 400 })
      buffer = Buffer.from(b64, 'base64')
    } else {
      const formData = await req.formData()
      const fileField = formData.get('file') as File | null
      clientId = (formData.get('client_id') as string) || ''
      if (!fileField) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      filename = fileField.name || filename
      mimeType = fileField.type || mimeType
      buffer = Buffer.from(await fileField.arrayBuffer())
    }
  } catch {
    return NextResponse.json({ error: 'Invalid upload payload' }, { status: 400 })
  }

  if (!clientId) {
    return NextResponse.json({ error: 'A client must be selected to upload media.' }, { status: 400 })
  }
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum upload size is ${MAX_BYTES / (1024 * 1024)}MB.` },
      { status: 400 },
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, company_name, google_drive_folder_id')
    .eq('id', clientId)
    .eq('organization_id', userData.organization_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Ensure Drive is connected before attempting an upload — surface a clear 400.
  const { data: tokenRows } = await supabase
    .from('organization_settings')
    .select('key')
    .in('key', ['google_access_token', 'google_refresh_token'])
  const hasToken = (tokenRows || []).some((r: any) => r.key === 'google_refresh_token')
  if (!hasToken) {
    return NextResponse.json(
      { error: 'Google Drive is not connected. Connect it in Settings before uploading media.' },
      { status: 400 },
    )
  }

  let rootFolderId = client.google_drive_folder_id
  try {
    if (!rootFolderId) {
      rootFolderId = await createClientFolder(supabase, client.company_name)
      await supabase.from('clients').update({ google_drive_folder_id: rootFolderId }).eq('id', clientId)
    }

    const driveFile = await uploadFile(supabase, rootFolderId, buffer, filename, mimeType)

    // Persist metadata (non-fatal), mirroring the client drive upload route.
    try {
      await supabase.from('google_drive_files').insert({
        client_id: clientId,
        organization_id: userData.organization_id,
        file_id: driveFile.id,
        name: driveFile.name,
        mime_type: driveFile.mimeType,
        size: driveFile.size ? parseInt(driveFile.size) : null,
        folder_id: rootFolderId,
        web_view_link: driveFile.webViewLink,
      })
    } catch { /* ignore */ }

    return NextResponse.json({ url: driveFile.webViewLink, file_id: driveFile.id }, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (/not connected/i.test(msg)) {
      return NextResponse.json(
        { error: 'Google Drive is not connected. Connect it in Settings before uploading media.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Failed to upload to Google Drive.' }, { status: 500 })
  }
}
