import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientFolder, createProjectFolder, listSubfolders } from '@/lib/google-drive'

async function getClientWithFolder(supabase: any, clientId: string, orgId: string) {
  const { data: client } = await supabase
    .from('clients')
    .select('id, company_name, google_drive_folder_id')
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .single()
  return client
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const client = await getClientWithFolder(supabase, params.id, userData.organization_id)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let folderId = client.google_drive_folder_id
  if (!folderId) {
    folderId = await createClientFolder(supabase, client.company_name)
    await supabase.from('clients').update({ google_drive_folder_id: folderId }).eq('id', params.id)
  }

  const folders = await listSubfolders(supabase, folderId)
  return NextResponse.json({ root_folder_id: folderId, folders })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const client = await getClientWithFolder(supabase, params.id, userData.organization_id)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let folderId = client.google_drive_folder_id
  if (!folderId) {
    folderId = await createClientFolder(supabase, client.company_name)
    await supabase.from('clients').update({ google_drive_folder_id: folderId }).eq('id', params.id)
  }

  const body = await req.json()
  const { name, parent_folder_id } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const targetParent = parent_folder_id || folderId
  const newFolderId = await createProjectFolder(supabase, targetParent, name.trim())
  return NextResponse.json({ id: newFolderId, name: name.trim() }, { status: 201 })
}
