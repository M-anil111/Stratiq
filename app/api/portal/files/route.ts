import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listFiles, listFilesInFolder } from '@/lib/google-drive'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(company_name, google_drive_folder_id)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const clientData = portalAccess.clients as any
  const companyName = clientData?.company_name || 'Unknown'
  const folderId = clientData?.google_drive_folder_id

  try {
    if (folderId) {
      // Use OAuth-based Drive API with folder id
      const files = await listFiles(supabase, folderId)
      return NextResponse.json(files)
    } else {
      // Fallback: service-account lookup by folder name
      const files = await listFilesInFolder(companyName)
      return NextResponse.json(files)
    }
  } catch {
    return NextResponse.json([])
  }
}
