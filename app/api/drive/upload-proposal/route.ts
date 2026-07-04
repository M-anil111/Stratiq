import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFile, createOrgProposalsFolder } from '@/lib/google-drive'

// POST /api/drive/upload-proposal
// Uploads a proposal/agreement file to Drive → Stratiq/Proposals/
// Returns { url, name, id }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const { data: folderRow } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', 'proposals_drive_folder_id')
    .single()

  let folderId = folderRow?.value
  if (!folderId) {
    folderId = await createOrgProposalsFolder(supabase)
    await supabase.from('organization_settings').upsert({
      organization_id: userData.organization_id,
      key: 'proposals_drive_folder_id',
      value: folderId,
    }, { onConflict: 'organization_id,key' })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const driveFile = await uploadFile(supabase, folderId, buffer, file.name, file.type || 'application/pdf')

  return NextResponse.json({ url: driveFile.webViewLink, name: driveFile.name, id: driveFile.id })
}
