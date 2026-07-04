import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientFolder, listFiles } from '@/lib/google-drive'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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

  let folderId = client.google_drive_folder_id

  if (!folderId) {
    try {
      folderId = await createClientFolder(supabase, client.company_name)
      await supabase.from('clients').update({ google_drive_folder_id: folderId }).eq('id', params.id)
    } catch (err: any) {
      return NextResponse.json({ error: 'Failed to create Drive folder', detail: err.message }, { status: 500 })
    }
  }

  try {
    const files = await listFiles(supabase, folderId)
    return NextResponse.json({ folder_id: folderId, files })
  } catch (err: any) {
    return NextResponse.json({ folder_id: folderId, files: [], error: err.message })
  }
}
