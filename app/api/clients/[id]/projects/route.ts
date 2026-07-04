import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent } from '@/lib/encryption'
import { createClientFolder, createProjectFolder } from '@/lib/google-drive'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('projects')
    .select('*, tracking_tools(*), social_media_accounts(platform, username, profile_url)')
    .eq('client_id', params.id)
    .eq('organization_id', userData?.organization_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()

  // Create the project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      client_id: params.id,
      organization_id: userData.organization_id,
      domain: body.domain,
      status: body.status || 'active',
      industry: body.industry,
      services: body.services || [],
      advertising_types: body.advertising_types || [],
      goals: body.goals || [],
    })
    .select()
    .single()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })

  // Auto-create Drive subfolder for the project (non-fatal)
  try {
    const { data: clientData } = await supabase
      .from('clients')
      .select('company_name, google_drive_folder_id')
      .eq('id', params.id)
      .single()
    if (clientData) {
      let clientFolderId = clientData.google_drive_folder_id
      if (!clientFolderId) {
        clientFolderId = await createClientFolder(supabase, clientData.company_name)
        await supabase.from('clients').update({ google_drive_folder_id: clientFolderId }).eq('id', params.id)
      }
      const projectFolderId = await createProjectFolder(supabase, clientFolderId, body.domain || project.id)
      await supabase.from('projects').update({ google_drive_folder_id: projectFolderId }).eq('id', project.id)
      project.google_drive_folder_id = projectFolderId
    }
  } catch { /* Drive not connected — skip */ }

  // Insert tracking tools
  if (body.tracking_tools?.length) {
    await supabase.from('tracking_tools').insert(
      body.tracking_tools.filter((t: any) => t.tool_name).map((t: any) => ({ project_id: project.id, ...t }))
    )
  }

  // Insert credentials (encrypted)
  if (body.credentials?.length) {
    await supabase.from('login_credentials').insert(
      body.credentials.filter((c: any) => c.site_name).map((c: any, i: number) => ({
        project_id: project.id,
        site_name: c.site_name,
        username: c.username,
        password_encrypted: encryptIfPresent(c.password),
        sort_order: i,
      }))
    )
  }

  // Insert social accounts (encrypted)
  if (body.social_accounts?.length) {
    await supabase.from('social_media_accounts').insert(
      body.social_accounts.filter((a: any) => a.username || a.profile_url).map((a: any) => ({
        project_id: project.id,
        platform: a.platform,
        username: a.username,
        password_encrypted: encryptIfPresent(a.password),
        profile_url: a.profile_url,
      }))
    )
  }

  return NextResponse.json(project, { status: 201 })
}
