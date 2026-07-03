import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listFilesInFolder } from '@/lib/google-drive'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(company_name)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  try {
    const companyName = (portalAccess.clients as any)?.company_name || 'Unknown'
    const files = await listFilesInFolder(companyName)
    return NextResponse.json(files)
  } catch {
    return NextResponse.json([])
  }
}
