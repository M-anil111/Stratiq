import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent, decryptIfPresent } from '@/lib/encryption'

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('social_media_accounts')
    .select('*')
    .eq('project_id', params.projectId)
    .order('platform', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const decrypted = (data || []).map(({ encrypted_password, ...rest }: any) => ({
    ...rest,
    password: decryptIfPresent(encrypted_password),
  }))

  return NextResponse.json(decrypted)
}

export async function PUT(request: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { platform, username, password, profile_url } = body

  if (!platform?.trim()) {
    return NextResponse.json({ error: 'platform is required' }, { status: 400 })
  }

  // Check if record exists for this project+platform
  const { data: existing } = await supabase
    .from('social_media_accounts')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('platform', platform)
    .single()

  const payload: Record<string, unknown> = {
    project_id: params.projectId,
    platform,
    username,
    profile_url,
  }
  if (password !== undefined) {
    payload.encrypted_password = encryptIfPresent(password)
  }

  let data: any, error: any
  if (existing) {
    ;({ data, error } = await supabase
      .from('social_media_accounts')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single())
  } else {
    ;({ data, error } = await supabase
      .from('social_media_accounts')
      .insert(payload)
      .select()
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { encrypted_password, ...rest } = data as any
  return NextResponse.json({ ...rest, password: decryptIfPresent(encrypted_password) })
}
