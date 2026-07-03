import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listFilesInFolder } from '@/lib/google-drive'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data: client } = await supabase
    .from('clients')
    .select('company_name')
    .eq('id', params.id)
    .eq('organization_id', userData?.organization_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const files = await listFilesInFolder(client.company_name)
    return NextResponse.json(files)
  } catch {
    return NextResponse.json([])
  }
}
