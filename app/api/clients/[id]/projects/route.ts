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

  // Build the insert row. Some columns come from later migrations that may not
  // yet be applied to this DB (name/start_date/end_date/notes from 028, manager
  // FKs from 007). Rather than hard-failing, retry while stripping any column
  // PostgREST reports as missing from the schema cache — mirrors the pattern in
  // app/api/clients/route.ts so project creation always succeeds.
  const insertRow: Record<string, any> = {
    client_id: params.id,
    organization_id: userData.organization_id,
    domain: body.domain,
    status: body.status || 'active',
    industry: body.industry,
    services: body.services || [],
    advertising_types: body.advertising_types || [],
    goals: body.goals || [],
    name: body.name || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    notes: body.notes || null,
    sales_manager_id: body.sales_manager_id || null,
    dm_manager_id: body.dm_manager_id || null,
    proofhub_project_id: body.proofhub_project_id ? String(body.proofhub_project_id) : null,
  }

  let project: any = null
  let projectError: any = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase.from('projects').insert(insertRow).select().single()
    project = res.data
    projectError = res.error
    if (!projectError) break
    const missing = projectError.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in insertRow) {
      delete insertRow[missing]
      continue
    }
    break
  }

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
