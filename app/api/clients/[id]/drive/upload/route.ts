import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFile, createClientFolder } from '@/lib/google-drive'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: client } = await supabase
    .from('clients')
    .select('id, company_name, google_drive_folder_id')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let rootFolderId = client.google_drive_folder_id
  if (!rootFolderId) {
    rootFolderId = await createClientFolder(supabase, client.company_name)
    await supabase.from('clients').update({ google_drive_folder_id: rootFolderId }).eq('id', params.id)
  }

  const formData = await req.formData()
  const fileField = formData.get('file') as File | null
  const targetFolderId = (formData.get('target_folder_id') as string) || rootFolderId

  if (!fileField) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await fileField.arrayBuffer())
  const mimeType = fileField.type || 'application/octet-stream'

  const driveFile = await uploadFile(supabase, targetFolderId, buffer, fileField.name, mimeType)

  // Persist metadata in google_drive_files table (if it exists — ignore error if not)
  await supabase.from('google_drive_files').insert({
    client_id: params.id,
    organization_id: userData.organization_id,
    file_id: driveFile.id,
    name: driveFile.name,
    mime_type: driveFile.mimeType,
    size: driveFile.size ? parseInt(driveFile.size) : null,
    folder_id: targetFolderId,
    web_view_link: driveFile.webViewLink,
  }).then(() => {}).catch(() => {}) // non-fatal

  return NextResponse.json(driveFile, { status: 201 })
}
