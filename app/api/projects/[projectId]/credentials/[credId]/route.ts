import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptIfPresent, decryptIfPresent } from '@/lib/encryption'

export async function PUT(request: NextRequest, { params }: { params: { projectId: string; credId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { site_name, username, password } = body

  const updatePayload: Record<string, unknown> = {
    site_name,
    username,
    updated_at: new Date().toISOString(),
  }
  if (password !== undefined) {
    updatePayload.encrypted_password = encryptIfPresent(password)
  }

  const { data, error } = await supabase
    .from('login_credentials')
    .update(updatePayload)
    .eq('id', params.credId)
    .eq('project_id', params.projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { encrypted_password, ...rest } = data as any
  return NextResponse.json({ ...rest, password: decryptIfPresent(encrypted_password) })
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; credId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('login_credentials')
    .delete()
    .eq('id', params.credId)
    .eq('project_id', params.projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
